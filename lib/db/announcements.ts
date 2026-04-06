// =============================================================================
// lib/db/announcements.ts — Announcement CRUD queries (service layer)
// All database queries for announcements, comments, and reads go through
// this file.
// =============================================================================

import { createAdminClient } from '@/supabase/server'

// -----------------------------------------------------------------------------
// Row types (mirrors announcements / announcement_comments / announcement_reads
// tables from 001_initial_schema.sql)
// -----------------------------------------------------------------------------

export type AnnouncementRow = {
  id: string
  cohort_id: string
  teacher_id: string
  body: string
  file_url: string | null
  pinned: boolean
  pinned_at: string | null
  created_at: string
  deleted_at: string | null
  updated_at: string
}

export type AnnouncementCommentRow = {
  id: string
  announcement_id: string
  author_id: string
  author_type: string
  body: string
  created_at: string
  deleted_at: string | null
}

export type AnnouncementReadRow = {
  id: string
  announcement_id: string
  student_id: string
  read_at: string
}

// Comment joined with author info (student name for display)
export type CommentWithAuthor = AnnouncementCommentRow

// Input types
export type CreateAnnouncementInput = {
  cohortId: string
  teacherId: string
  body: string
  fileUrl?: string
}

export type CreateCommentInput = {
  announcementId: string
  authorId: string
  authorType: 'teacher' | 'student'
  body: string
}

// Unseen student type
export type UnseenStudent = {
  id: string
  name: string
  email: string
}

// -----------------------------------------------------------------------------
// getAnnouncementsByCohort — All non-deleted announcements for a cohort.
// Ordered: pinned first (by pinned_at desc), then by created_at desc.
// -----------------------------------------------------------------------------
export async function getAnnouncementsByCohort(
  cohortId: string
): Promise<AnnouncementRow[]> {
  const supabase = createAdminClient()

  // Supabase doesn't support ORDER BY with NULLS LAST natively in JS client.
  // We fetch all then sort in JS: pinned first (by pinned_at desc), then
  // by created_at desc.
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('cohort_id', cohortId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  const rows = data as AnnouncementRow[]

  // Sort: pinned first (by pinned_at desc), then by created_at desc
  rows.sort((a, b) => {
    // Pinned items come first
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1

    // Both pinned: sort by pinned_at desc
    if (a.pinned && b.pinned) {
      const aPinnedAt = a.pinned_at ? new Date(a.pinned_at).getTime() : 0
      const bPinnedAt = b.pinned_at ? new Date(b.pinned_at).getTime() : 0
      return bPinnedAt - aPinnedAt
    }

    // Both unpinned: sort by created_at desc
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return rows
}

// -----------------------------------------------------------------------------
// getAnnouncementById — Single announcement by ID (must not be soft-deleted)
// -----------------------------------------------------------------------------
export async function getAnnouncementById(
  id: string
): Promise<AnnouncementRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !data) return null
  return data as AnnouncementRow
}

// -----------------------------------------------------------------------------
// createAnnouncement — Insert a new announcement
// -----------------------------------------------------------------------------
export async function createAnnouncement(
  input: CreateAnnouncementInput
): Promise<AnnouncementRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('announcements')
    .insert({
      cohort_id: input.cohortId,
      teacher_id: input.teacherId,
      body: input.body,
      file_url: input.fileUrl ?? null,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return data as AnnouncementRow
}

// -----------------------------------------------------------------------------
// updateAnnouncement — Partial update with teacher_id ownership filter
// -----------------------------------------------------------------------------
export async function updateAnnouncement(
  id: string,
  teacherId: string,
  updates: { body?: string; fileUrl?: string | null }
): Promise<AnnouncementRow | null> {
  const supabase = createAdminClient()

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (updates.body !== undefined) updatePayload.body = updates.body
  if (updates.fileUrl !== undefined) updatePayload.file_url = updates.fileUrl

  const { data, error } = await supabase
    .from('announcements')
    .update(updatePayload)
    .eq('id', id)
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)
    .select('*')
    .single()

  if (error || !data) return null
  return data as AnnouncementRow
}

// -----------------------------------------------------------------------------
// deleteAnnouncement — Soft delete (set deleted_at) with ownership filter
// -----------------------------------------------------------------------------
export async function deleteAnnouncement(
  id: string,
  teacherId: string
): Promise<boolean> {
  const supabase = createAdminClient()

  const { error, count } = await supabase
    .from('announcements')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)

  return !error && (count === null || count > 0)
}

// -----------------------------------------------------------------------------
// pinAnnouncement — Set pinned + pinned_at with ownership filter
// pinned=true → set pinned_at to now; pinned=false → clear pinned_at
// -----------------------------------------------------------------------------
export async function pinAnnouncement(
  id: string,
  teacherId: string,
  pinned: boolean
): Promise<AnnouncementRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('announcements')
    .update({
      pinned,
      pinned_at: pinned ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)
    .select('*')
    .single()

  if (error || !data) return null
  return data as AnnouncementRow
}

// =============================================================================
// Comments
// =============================================================================

// -----------------------------------------------------------------------------
// getCommentById — Single comment by ID (must not be soft-deleted)
// -----------------------------------------------------------------------------
export async function getCommentById(
  id: string
): Promise<AnnouncementCommentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('announcement_comments')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !data) return null
  return data as AnnouncementCommentRow
}

// -----------------------------------------------------------------------------
// getCommentsByAnnouncement — All non-deleted comments, oldest first
// -----------------------------------------------------------------------------
export async function getCommentsByAnnouncement(
  announcementId: string
): Promise<AnnouncementCommentRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('announcement_comments')
    .select('*')
    .eq('announcement_id', announcementId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error || !data) return []
  return data as AnnouncementCommentRow[]
}

// -----------------------------------------------------------------------------
// createComment — Insert a new comment
// -----------------------------------------------------------------------------
export async function createComment(
  input: CreateCommentInput
): Promise<AnnouncementCommentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('announcement_comments')
    .insert({
      announcement_id: input.announcementId,
      author_id: input.authorId,
      author_type: input.authorType,
      body: input.body,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return data as AnnouncementCommentRow
}

// -----------------------------------------------------------------------------
// deleteComment — Soft delete (teacher moderation). Verifies the comment
// belongs to an announcement owned by this teacher.
// -----------------------------------------------------------------------------
export async function deleteComment(
  commentId: string,
  teacherId: string
): Promise<boolean> {
  const supabase = createAdminClient()

  // 1. Fetch the comment to get its announcement_id
  const { data: comment, error: commentError } = await supabase
    .from('announcement_comments')
    .select('id, announcement_id')
    .eq('id', commentId)
    .is('deleted_at', null)
    .single()

  if (commentError || !comment) return false

  // 2. Verify the announcement belongs to this teacher
  const { data: announcement, error: announcementError } = await supabase
    .from('announcements')
    .select('id')
    .eq('id', (comment as { id: string; announcement_id: string }).announcement_id)
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)
    .single()

  if (announcementError || !announcement) return false

  // 3. Soft delete the comment
  const { error: deleteError } = await supabase
    .from('announcement_comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId)

  return !deleteError
}

// =============================================================================
// Reads / Seen tracking
// =============================================================================

// -----------------------------------------------------------------------------
// getAnnouncementReads — Count + list of student_ids who read
// -----------------------------------------------------------------------------
export async function getAnnouncementReads(
  announcementId: string
): Promise<{ count: number; studentIds: string[] }> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('announcement_reads')
    .select('student_id')
    .eq('announcement_id', announcementId)

  if (error || !data) return { count: 0, studentIds: [] }

  const rows = data as Array<{ student_id: string }>
  return {
    count: rows.length,
    studentIds: rows.map((r) => r.student_id),
  }
}

// -----------------------------------------------------------------------------
// markAnnouncementRead — Upsert a read record (idempotent)
// Uses onConflict on the UNIQUE(announcement_id, student_id) constraint
// -----------------------------------------------------------------------------
export async function markAnnouncementRead(
  announcementId: string,
  studentId: string
): Promise<boolean> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('announcement_reads')
    .upsert(
      {
        announcement_id: announcementId,
        student_id: studentId,
        read_at: new Date().toISOString(),
      },
      { onConflict: 'announcement_id,student_id' }
    )

  return !error
}

// -----------------------------------------------------------------------------
// getSeenByCount — Count of reads for an announcement
// -----------------------------------------------------------------------------
export async function getSeenByCount(
  announcementId: string
): Promise<number> {
  const supabase = createAdminClient()

  const { count } = await supabase
    .from('announcement_reads')
    .select('*', { count: 'exact', head: true })
    .eq('announcement_id', announcementId)

  return count ?? 0
}

// -----------------------------------------------------------------------------
// getAnnouncementReadsByStudent — Set of announcement IDs that a student
// has read in a given cohort. Used by student announcement view.
// -----------------------------------------------------------------------------
export async function getAnnouncementReadsByStudent(
  studentId: string,
  announcementIds: string[]
): Promise<Set<string>> {
  if (announcementIds.length === 0) return new Set()

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('announcement_reads')
    .select('announcement_id')
    .eq('student_id', studentId)
    .in('announcement_id', announcementIds)

  if (error || !data) return new Set()
  return new Set(
    (data as Array<{ announcement_id: string }>).map((r) => r.announcement_id)
  )
}

// -----------------------------------------------------------------------------
// getRecentAnnouncementsByStudent — Recent announcements across all cohorts
// the student is actively enrolled in. Returns up to `limit` announcements,
// newest first, with cohort + course + teacher info for dashboard display.
// -----------------------------------------------------------------------------
export type AnnouncementForStudentDashboard = AnnouncementRow & {
  cohorts: {
    id: string
    name: string
    courses: { id: string; title: string }
    teachers: { id: string; name: string }
  }
}

export async function getRecentAnnouncementsByStudent(
  studentId: string,
  limit: number
): Promise<AnnouncementForStudentDashboard[]> {
  const supabase = createAdminClient()

  // 1. Get cohort IDs for the student's active enrollments
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('cohort_id')
    .eq('student_id', studentId)
    .eq('status', 'active')

  if (enrollError || !enrollments || enrollments.length === 0) return []

  const cohortIds = (enrollments as Array<{ cohort_id: string }>).map(
    (e) => e.cohort_id
  )

  // 2. Fetch recent announcements for those cohorts
  const { data, error } = await supabase
    .from('announcements')
    .select(`
      *,
      cohorts!inner(
        id, name,
        courses!inner(id, title),
        teachers!inner(id, name)
      )
    `)
    .in('cohort_id', cohortIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data as AnnouncementForStudentDashboard[]
}

// -----------------------------------------------------------------------------
// getUnseenStudents — Students enrolled in cohort who haven't read the
// announcement. Uses two-step approach (Supabase .in() doesn't accept
// subqueries — fetch IDs first, then filter).
// -----------------------------------------------------------------------------
export async function getUnseenStudents(
  announcementId: string,
  cohortId: string
): Promise<UnseenStudent[]> {
  const supabase = createAdminClient()

  // 1. Get all active enrolled student IDs for this cohort
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('student_id')
    .eq('cohort_id', cohortId)
    .eq('status', 'active')

  if (enrollError || !enrollments || enrollments.length === 0) return []

  const enrolledIds = (enrollments as Array<{ student_id: string }>).map(
    (e) => e.student_id
  )

  // 2. Get student IDs who HAVE read this announcement
  const { data: reads, error: readError } = await supabase
    .from('announcement_reads')
    .select('student_id')
    .eq('announcement_id', announcementId)

  if (readError) return []

  const readIds = new Set(
    (reads as Array<{ student_id: string }> | null)?.map((r) => r.student_id) ?? []
  )

  // 3. Filter to unseen student IDs
  const unseenIds = enrolledIds.filter((id) => !readIds.has(id))

  if (unseenIds.length === 0) return []

  // 4. Fetch student details for unseen students
  const { data: students, error: studentError } = await supabase
    .from('students')
    .select('id, name, email')
    .in('id', unseenIds)

  if (studentError || !students) return []
  return students as UnseenStudent[]
}
