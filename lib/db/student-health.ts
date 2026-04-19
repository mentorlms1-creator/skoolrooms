// =============================================================================
// lib/db/student-health.ts — On-demand health-signal queries scoped to one
// teacher. Each helper caps results at 200 rows so the page never balloons.
// =============================================================================

import { createAdminClient } from '@/supabase/server'
import { getAttendanceSummary } from '@/lib/db/attendance'

const ROW_CAP = 200

export type AtRiskRow = {
  student_id: string
  name: string
  email: string
  cohort_id: string
  cohort_name: string
  course_id: string
  course_title: string
  attended: number
  total: number
  percentage: number
}

export type DisengagedRow = {
  student_id: string
  name: string
  email: string
  last_login_at: string | null
  enrollments_count: number
}

export type NoSubmissionRow = {
  student_id: string
  name: string
  email: string
  cohort_id: string
  cohort_name: string
  course_id: string
  course_title: string
  assignment_count: number
}

type ActiveEnrollment = {
  id: string
  student_id: string
  created_at: string
  students: { id: string; name: string; email: string; last_login_at: string | null }
  cohorts: {
    id: string
    name: string
    status: string
    courses: { id: string; title: string }
  }
}

async function fetchTeacherActiveEnrollments(teacherId: string): Promise<ActiveEnrollment[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id, student_id, created_at,
      students!inner(id, name, email, last_login_at),
      cohorts!inner(id, name, status, teacher_id, courses!inner(id, title))
    `)
    .eq('status', 'active')
    .eq('cohorts.teacher_id', teacherId)
    .neq('cohorts.status', 'archived')

  if (error || !data) return []
  return data as unknown as ActiveEnrollment[]
}

// -----------------------------------------------------------------------------
// listAtRiskStudents — attendance < 70% across enrollments under this teacher.
// Skip cohorts with fewer than 3 sessions to avoid noise on brand-new cohorts.
// -----------------------------------------------------------------------------
export async function listAtRiskStudents(teacherId: string): Promise<AtRiskRow[]> {
  const enrollments = await fetchTeacherActiveEnrollments(teacherId)
  if (enrollments.length === 0) return []

  const rows: AtRiskRow[] = []
  for (const e of enrollments) {
    const summary = await getAttendanceSummary(e.student_id, e.cohorts.id)
    if (summary.total < 3) continue
    if (summary.percentage >= 70) continue
    rows.push({
      student_id: e.students.id,
      name: e.students.name,
      email: e.students.email,
      cohort_id: e.cohorts.id,
      cohort_name: e.cohorts.name,
      course_id: e.cohorts.courses.id,
      course_title: e.cohorts.courses.title,
      attended: summary.attended,
      total: summary.total,
      percentage: summary.percentage,
    })
    if (rows.length >= ROW_CAP) break
  }

  rows.sort((a, b) => a.percentage - b.percentage)
  return rows
}

// -----------------------------------------------------------------------------
// listDisengagedStudents — students who haven't logged in for `daysThreshold`
// days, OR have never logged in but enrolled more than `daysThreshold` ago.
// Aggregates per-student so the same student isn't repeated per enrollment.
// -----------------------------------------------------------------------------
export async function listDisengagedStudents(
  teacherId: string,
  daysThreshold = 10,
): Promise<DisengagedRow[]> {
  const enrollments = await fetchTeacherActiveEnrollments(teacherId)
  if (enrollments.length === 0) return []

  const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000)

  const byStudent = new Map<string, DisengagedRow>()
  for (const e of enrollments) {
    const lastLogin = e.students.last_login_at
    const enrolledAt = new Date(e.created_at)
    let isDisengaged: boolean
    if (lastLogin) {
      isDisengaged = new Date(lastLogin) < cutoff
    } else {
      isDisengaged = enrolledAt < cutoff
    }
    if (!isDisengaged) continue

    const existing = byStudent.get(e.student_id)
    if (existing) {
      existing.enrollments_count += 1
    } else {
      byStudent.set(e.student_id, {
        student_id: e.students.id,
        name: e.students.name,
        email: e.students.email,
        last_login_at: lastLogin,
        enrollments_count: 1,
      })
    }
  }

  const rows = Array.from(byStudent.values())
  rows.sort((a, b) => {
    const aTime = a.last_login_at ? new Date(a.last_login_at).getTime() : 0
    const bTime = b.last_login_at ? new Date(b.last_login_at).getTime() : 0
    return aTime - bTime
  })
  return rows.slice(0, ROW_CAP)
}

// -----------------------------------------------------------------------------
// listNoSubmissionStudents — for cohorts with at least one assignment, find
// active students who have submitted nothing.
// -----------------------------------------------------------------------------
export async function listNoSubmissionStudents(
  teacherId: string,
): Promise<NoSubmissionRow[]> {
  const supabase = createAdminClient()
  const enrollments = await fetchTeacherActiveEnrollments(teacherId)
  if (enrollments.length === 0) return []

  const cohortIds = Array.from(new Set(enrollments.map((e) => e.cohorts.id)))

  const { data: assignments } = await supabase
    .from('assignments')
    .select('id, cohort_id')
    .in('cohort_id', cohortIds)
    .is('deleted_at', null)

  const assignmentsByCohort = new Map<string, string[]>()
  for (const a of (assignments as Array<{ id: string; cohort_id: string }> | null) ?? []) {
    const list = assignmentsByCohort.get(a.cohort_id) ?? []
    list.push(a.id)
    assignmentsByCohort.set(a.cohort_id, list)
  }

  // Collect unique student IDs that need a submission lookup.
  const studentIds = Array.from(new Set(enrollments.map((e) => e.student_id)))
  const allAssignmentIds = (assignments as Array<{ id: string }> | null)?.map((a) => a.id) ?? []

  const submittedKey = new Set<string>()
  if (allAssignmentIds.length > 0 && studentIds.length > 0) {
    const { data: subs } = await supabase
      .from('assignment_submissions')
      .select('assignment_id, student_id')
      .in('assignment_id', allAssignmentIds)
      .in('student_id', studentIds)
    for (const s of (subs as Array<{ assignment_id: string; student_id: string }> | null) ?? []) {
      submittedKey.add(`${s.student_id}:${s.assignment_id}`)
    }
  }

  const rows: NoSubmissionRow[] = []
  for (const e of enrollments) {
    const cohortAssignments = assignmentsByCohort.get(e.cohorts.id) ?? []
    if (cohortAssignments.length === 0) continue
    const hasAny = cohortAssignments.some((aid) => submittedKey.has(`${e.student_id}:${aid}`))
    if (hasAny) continue
    rows.push({
      student_id: e.students.id,
      name: e.students.name,
      email: e.students.email,
      cohort_id: e.cohorts.id,
      cohort_name: e.cohorts.name,
      course_id: e.cohorts.courses.id,
      course_title: e.cohorts.courses.title,
      assignment_count: cohortAssignments.length,
    })
    if (rows.length >= ROW_CAP) break
  }

  rows.sort((a, b) => b.assignment_count - a.assignment_count)
  return rows
}
