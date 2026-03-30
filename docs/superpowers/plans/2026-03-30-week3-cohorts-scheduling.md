# Week 3: Cohorts + Class Scheduling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teachers can create cohorts under published courses, set schedules with single or recurring classes (via rrule.js eager expansion), share invite links. Visiting an invite link shows an enrollment page. Cohort archiving works (manual + cron). Archived cohorts are permanently read-only.

**Architecture:** Next.js 16 App Router. Mutations use Server Actions (NOT API routes — per CLAUDE.md rule 12). Database queries in `lib/db/*.ts`. `createAdminClient()` is sync (NOT async). All Server Actions verify ownership before mutation. All timestamps UTC in DB, PKT for display. Plan limits enforced server-side.

**Tech Stack:** Next.js 16, React 19, Supabase (Postgres + RLS), Tailwind CSS v4, rrule (recurring schedules), TypeScript strict.

**Lessons from prior weeks (MUST follow):**
- Every Server Action that mutates a resource MUST verify ownership (course.teacher_id === teacher.id)
- `createAdminClient()` is sync — never `await createAdminClient()`
- Sanitize all user-generated HTML before rendering with `sanitize-html`
- Use theme tokens only — no raw hex, no Tailwind defaults
- Onboarding steps are: profile_complete, payment_details_set, course_created, cohort_created, link_shared

---

## File Structure

### New files to create:

```
# Database service layer
lib/db/cohorts.ts                         — Cohort CRUD queries
lib/db/class-sessions.ts                  — Class session queries

# Server actions
lib/actions/cohorts.ts                    — Cohort create/edit/archive/delete
lib/actions/class-sessions.ts             — Session create/cancel

# Cohort pages (nested under course)
app/(teacher)/dashboard/courses/[courseId]/cohorts/new/page.tsx
app/(teacher)/dashboard/courses/[courseId]/cohorts/new/form.tsx
app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/page.tsx
app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/edit/page.tsx
app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/edit/form.tsx
app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/schedule/page.tsx
app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/schedule/form.tsx

# Public enrollment page
app/(teacher-public)/[subdomain]/join/[token]/page.tsx

# Cron job
app/api/cron/archive-cohorts/route.ts

# Components
components/teacher/CohortCard.tsx         — Cohort card for course detail page
components/teacher/InviteLinkCopy.tsx      — Copy invite link + fires onboarding step
components/teacher/SessionCard.tsx         — Class session display card
components/teacher/CalendarView.tsx        — Weekly/monthly calendar
components/teacher/SessionCreateForm.tsx   — Single + recurring session form
```

### Files to modify:
```
app/(teacher)/dashboard/courses/[courseId]/page.tsx  — Add cohort list to course detail
constants/routes.ts                                  — Add join route if missing
types/domain.ts                                      — Verify CohortStatus, FeeType exist
```

---

## Task 1: Database Service Layer — Cohorts + Class Sessions

**Files:**
- Create: `lib/db/cohorts.ts`
- Create: `lib/db/class-sessions.ts`

- [ ] **Step 1: Create cohort DB service**

Read existing patterns from `lib/db/courses.ts` and `lib/db/teachers.ts` first. Then create:

```typescript
// lib/db/cohorts.ts
import { createAdminClient } from '@/supabase/server'
import { v4 as uuidv4 } from 'uuid'

export async function getCohortsByTeacher(teacherId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('cohorts')
    .select('*')
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  return data || []
}

export async function getCohortsByCourse(courseId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('cohorts')
    .select('*')
    .eq('course_id', courseId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  return data || []
}

export async function getCohortById(cohortId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('cohorts')
    .select('*')
    .eq('id', cohortId)
    .is('deleted_at', null)
    .single()
  return data || null
}

export async function getCohortByInviteToken(token: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('cohorts')
    .select('*, courses!inner(id, title, description, status, thumbnail_url, teacher_id)')
    .eq('invite_token', token)
    .is('deleted_at', null)
    .single()
  return data || null
}

export async function createCohort(input: {
  teacherId: string
  courseId: string
  name: string
  startDate: string
  endDate: string
  maxStudents: number | null
  feeType: string
  feePkr: number
  billingDay: number | null
  isRegistrationOpen: boolean
  waitlistEnabled: boolean
  pendingCanSeeSchedule: boolean
  pendingCanSeeAnnouncements: boolean
}) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('cohorts')
    .insert({
      teacher_id: input.teacherId,
      course_id: input.courseId,
      name: input.name,
      start_date: input.startDate,
      end_date: input.endDate,
      max_students: input.maxStudents,
      fee_type: input.feeType,
      fee_pkr: input.feePkr,
      billing_day: input.billingDay,
      invite_token: uuidv4(),
      status: 'upcoming',
      is_registration_open: input.isRegistrationOpen,
      waitlist_enabled: input.waitlistEnabled,
      pending_can_see_schedule: input.pendingCanSeeSchedule,
      pending_can_see_announcements: input.pendingCanSeeAnnouncements,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateCohort(
  cohortId: string,
  teacherId: string,
  updates: Record<string, unknown>
) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('cohorts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', cohortId)
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) return null
  return data
}

export async function archiveCohort(cohortId: string, teacherId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('cohorts')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
      is_registration_open: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cohortId)
    .eq('teacher_id', teacherId)

  if (error) throw new Error(error.message)
}

export async function countActiveCohorts(teacherId: string): Promise<number> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Active = status 'active' OR (status 'upcoming' AND start_date <= today)
  const { count: activeCount } = await supabase
    .from('cohorts')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('status', 'active')
    .is('deleted_at', null)

  const { count: upcomingActiveCount } = await supabase
    .from('cohorts')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('status', 'upcoming')
    .lte('start_date', today)
    .is('deleted_at', null)

  return (activeCount || 0) + (upcomingActiveCount || 0)
}

export async function getWaitlistCount(cohortId: string): Promise<number> {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from('cohort_waitlist')
    .select('*', { count: 'exact', head: true })
    .eq('cohort_id', cohortId)
    .eq('status', 'waiting')
  return count || 0
}

export async function getActiveEnrollmentCount(cohortId: string): Promise<number> {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('cohort_id', cohortId)
    .eq('status', 'active')
  return count || 0
}

// Compute display status from DB fields
export function computeCohortDisplayStatus(cohort: {
  status: string
  start_date: string
  is_registration_open: boolean
  max_students: number | null
}, activeEnrollmentCount: number): string {
  if (cohort.status === 'archived') return 'archived'
  if (cohort.status === 'draft') return 'draft'

  // Upcoming that has started = treat as active
  const isActive = cohort.status === 'active' ||
    (cohort.status === 'upcoming' && new Date(cohort.start_date) <= new Date())

  if (!isActive) return 'upcoming'

  if (!cohort.is_registration_open) return 'closed'
  if (cohort.max_students !== null && activeEnrollmentCount >= cohort.max_students) return 'full'
  return 'open'
}
```

- [ ] **Step 2: Create class sessions DB service**

```typescript
// lib/db/class-sessions.ts
import { createAdminClient } from '@/supabase/server'

export async function getSessionsByCohort(cohortId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('class_sessions')
    .select('*')
    .eq('cohort_id', cohortId)
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: true })
  return data || []
}

export async function getSessionById(sessionId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('class_sessions')
    .select('*')
    .eq('id', sessionId)
    .is('deleted_at', null)
    .single()
  return data || null
}

export async function getUpcomingSessionsByTeacher(teacherId: string, limit = 20) {
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('class_sessions')
    .select('*, cohorts!inner(id, name, teacher_id, course_id)')
    .eq('cohorts.teacher_id', teacherId)
    .gte('scheduled_at', now)
    .is('cancelled_at', null)
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: true })
    .limit(limit)
  return data || []
}

export async function createSession(input: {
  cohortId: string
  meetLink: string
  scheduledAt: string
  durationMinutes: number
  isRecurring: boolean
  recurrenceRule: string | null
}) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('class_sessions')
    .insert({
      cohort_id: input.cohortId,
      meet_link: input.meetLink,
      scheduled_at: input.scheduledAt,
      duration_minutes: input.durationMinutes,
      is_recurring: input.isRecurring,
      recurrence_rule: input.recurrenceRule,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function createSessionsBatch(sessions: Array<{
  cohort_id: string
  meet_link: string
  scheduled_at: string
  duration_minutes: number
  is_recurring: boolean
  recurrence_rule: string | null
}>) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('class_sessions')
    .insert(sessions)
    .select()

  if (error) throw new Error(error.message)
  return data || []
}

export async function cancelSession(sessionId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('class_sessions')
    .update({
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)
}

export async function deleteFutureSessions(cohortId: string) {
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('class_sessions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('cohort_id', cohortId)
    .gte('scheduled_at', now)
    .is('cancelled_at', null)

  if (error) throw new Error(error.message)
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add lib/db/cohorts.ts lib/db/class-sessions.ts
git commit -m "feat: add cohort and class session database service layers"
```

---

## Task 2: Cohort Server Actions

**Files:**
- Create: `lib/actions/cohorts.ts`

- [ ] **Step 1: Create cohort server actions**

Read `lib/actions/courses.ts` for the pattern. Key requirements:
- Verify ownership on all mutations
- Plan limit check (max_cohorts_active) on create
- billing_day 1-28 validation for monthly cohorts
- Archived cohort write guard
- Waitlist notification on max_students increase
- Fire onboarding step 'cohort_created' on first cohort creation

```typescript
// lib/actions/cohorts.ts
'use server'

import { createClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { getCourseById } from '@/lib/db/courses'
import {
  getCohortById,
  createCohort,
  updateCohort,
  archiveCohort,
  countActiveCohorts,
  getWaitlistCount,
  getActiveEnrollmentCount,
} from '@/lib/db/cohorts'
import { getLimit } from '@/lib/plans/limits'
import { completeOnboardingStep } from '@/lib/actions/onboarding'
import type { ApiResponse } from '@/types/api'

async function getAuthenticatedTeacher() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return getTeacherByAuthId(user.id)
}

export async function createCohortAction(
  formData: FormData
): Promise<ApiResponse<{ cohortId: string; inviteToken: string }>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }

  const courseId = formData.get('course_id') as string
  const name = (formData.get('name') as string)?.trim() ?? ''
  const startDate = formData.get('start_date') as string
  const endDate = formData.get('end_date') as string
  const feeType = formData.get('fee_type') as string
  const feePkr = parseInt(formData.get('fee_pkr') as string, 10)
  const billingDay = formData.get('billing_day') ? parseInt(formData.get('billing_day') as string, 10) : null
  const maxStudents = formData.get('max_students') ? parseInt(formData.get('max_students') as string, 10) : null
  const isRegistrationOpen = formData.get('is_registration_open') !== 'false'
  const waitlistEnabled = formData.get('waitlist_enabled') === 'true'
  const pendingCanSeeSchedule = formData.get('pending_can_see_schedule') === 'true'
  const pendingCanSeeAnnouncements = formData.get('pending_can_see_announcements') === 'true'

  // Validate required fields
  if (!name || name.length < 2) return { success: false, error: 'Cohort name is required' }
  if (!courseId) return { success: false, error: 'Course is required' }
  if (!startDate || !endDate) return { success: false, error: 'Start and end dates are required' }
  if (new Date(endDate) <= new Date(startDate)) return { success: false, error: 'End date must be after start date' }
  if (!feeType || !['one_time', 'monthly'].includes(feeType)) return { success: false, error: 'Fee type must be one_time or monthly' }
  if (isNaN(feePkr) || feePkr < 0) return { success: false, error: 'Fee must be a valid amount' }

  // billing_day validation: 1-28 for monthly only
  if (feeType === 'monthly') {
    if (billingDay === null || billingDay < 1 || billingDay > 28) {
      return { success: false, error: 'Billing day must be between 1 and 28' }
    }
  }

  // Verify course ownership
  const course = await getCourseById(courseId)
  if (!course || course.teacher_id !== teacher.id) {
    return { success: false, error: 'Course not found' }
  }

  // Plan limit check
  const [currentCount, limit] = await Promise.all([
    countActiveCohorts(teacher.id),
    getLimit(teacher.id, 'max_cohorts_active'),
  ])
  if (currentCount >= limit) {
    return { success: false, error: 'You have reached your cohort limit. Upgrade to create more.', code: 'LIMIT_REACHED' }
  }

  const cohort = await createCohort({
    teacherId: teacher.id,
    courseId,
    name,
    startDate,
    endDate,
    maxStudents,
    feeType,
    feePkr,
    billingDay: feeType === 'monthly' ? billingDay : null,
    isRegistrationOpen,
    waitlistEnabled,
    pendingCanSeeSchedule,
    pendingCanSeeAnnouncements,
  })

  // Mark onboarding step
  await completeOnboardingStep('cohort_created')

  return { success: true, data: { cohortId: cohort.id, inviteToken: cohort.invite_token } }
}

export async function updateCohortAction(
  cohortId: string,
  formData: FormData
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }

  // Verify ownership
  const cohort = await getCohortById(cohortId)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Cohort not found' }
  }

  // Archived cohort write guard
  if (cohort.status === 'archived') {
    return { success: false, error: 'This cohort is archived. No changes allowed.', code: 'COHORT_ARCHIVED' }
  }

  const updates: Record<string, unknown> = {}
  const name = formData.get('name') as string | null
  const maxStudents = formData.get('max_students') as string | null
  const billingDay = formData.get('billing_day') as string | null
  const isRegistrationOpen = formData.get('is_registration_open') as string | null
  const waitlistEnabled = formData.get('waitlist_enabled') as string | null
  const pendingCanSeeSchedule = formData.get('pending_can_see_schedule') as string | null
  const pendingCanSeeAnnouncements = formData.get('pending_can_see_announcements') as string | null

  if (name !== null) updates.name = name.trim()
  if (isRegistrationOpen !== null) updates.is_registration_open = isRegistrationOpen !== 'false'
  if (waitlistEnabled !== null) updates.waitlist_enabled = waitlistEnabled === 'true'
  if (pendingCanSeeSchedule !== null) updates.pending_can_see_schedule = pendingCanSeeSchedule === 'true'
  if (pendingCanSeeAnnouncements !== null) updates.pending_can_see_announcements = pendingCanSeeAnnouncements === 'true'

  if (maxStudents !== null) {
    const newMax = maxStudents === '' ? null : parseInt(maxStudents, 10)
    updates.max_students = newMax

    // If max_students increased and waitlist has entries, notify teacher
    if (newMax !== null && cohort.max_students !== null && newMax > cohort.max_students) {
      const waitlistCount = await getWaitlistCount(cohortId)
      if (waitlistCount > 0) {
        // Import sendEmail here to avoid circular deps
        const { sendEmail } = await import('@/lib/email/sender')
        await sendEmail({
          to: teacher.email,
          type: 'waitlist_slots_available',
          subject: `${waitlistCount} students waiting for ${cohort.name}`,
          htmlContent: `<p>You increased the student limit for <strong>${cohort.name}</strong>. There are ${waitlistCount} students on the waitlist. Contact them to complete enrollment.</p>`,
          teacherId: teacher.id,
        })
      }
    }
  }

  if (billingDay !== null) {
    const day = parseInt(billingDay, 10)
    if (day < 1 || day > 28) {
      return { success: false, error: 'Billing day must be between 1 and 28' }
    }
    updates.billing_day = day
  }

  const updated = await updateCohort(cohortId, teacher.id, updates)
  if (!updated) return { success: false, error: 'Failed to update cohort' }

  return { success: true, data: null }
}

export async function archiveCohortAction(
  cohortId: string
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }

  const cohort = await getCohortById(cohortId)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Cohort not found' }
  }

  if (cohort.status === 'archived') {
    return { success: false, error: 'Cohort is already archived' }
  }

  await archiveCohort(cohortId, teacher.id)

  // Auto-reject pending enrollments
  const { createAdminClient } = await import('@/supabase/server')
  const supabase = createAdminClient()
  await supabase
    .from('enrollments')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('cohort_id', cohortId)
    .eq('status', 'pending')

  // Expire waitlist entries
  await supabase
    .from('cohort_waitlist')
    .update({ status: 'expired' })
    .eq('cohort_id', cohortId)
    .eq('status', 'waiting')

  return { success: true, data: null }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add lib/actions/cohorts.ts
git commit -m "feat: add cohort server actions with plan limits and archive guard"
```

---

## Task 3: Class Session Server Actions

**Files:**
- Create: `lib/actions/class-sessions.ts`

- [ ] **Step 1: Create class session server actions with rrule expansion**

```typescript
// lib/actions/class-sessions.ts
'use server'

import { createClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { getCohortById } from '@/lib/db/cohorts'
import {
  createSession,
  createSessionsBatch,
  cancelSession,
  getSessionById,
} from '@/lib/db/class-sessions'
import { RRule } from 'rrule'
import type { ApiResponse } from '@/types/api'

async function getAuthenticatedTeacher() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return getTeacherByAuthId(user.id)
}

export async function createSessionAction(
  formData: FormData
): Promise<ApiResponse<{ sessionIds: string[] }>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }

  const cohortId = formData.get('cohort_id') as string
  const meetLink = (formData.get('meet_link') as string)?.trim() ?? ''
  const scheduledAt = formData.get('scheduled_at') as string
  const durationMinutes = parseInt(formData.get('duration_minutes') as string || '60', 10)
  const isRecurring = formData.get('is_recurring') === 'true'
  const recurrenceRule = formData.get('recurrence_rule') as string | null

  // Validate
  if (!cohortId) return { success: false, error: 'Cohort is required' }
  if (!meetLink) return { success: false, error: 'Meet link is required' }
  if (!scheduledAt) return { success: false, error: 'Date and time is required' }

  // Verify cohort ownership
  const cohort = await getCohortById(cohortId)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Cohort not found' }
  }

  // Archived cohort write guard
  if (cohort.status === 'archived') {
    return { success: false, error: 'This cohort is archived. No changes allowed.', code: 'COHORT_ARCHIVED' }
  }

  if (isRecurring && recurrenceRule) {
    // Eager expansion: generate all session dates until cohort end_date
    try {
      const rule = RRule.fromString(recurrenceRule)
      const startDt = new Date(scheduledAt)
      const endDt = new Date(cohort.end_date + 'T23:59:59Z')

      // Get the time portion from scheduledAt (hours, minutes)
      const hours = startDt.getUTCHours()
      const minutes = startDt.getUTCMinutes()

      // Generate dates
      const dates = rule.between(startDt, endDt, true)

      if (dates.length === 0) {
        return { success: false, error: 'No sessions generated for the given schedule. Check your dates and recurrence rule.' }
      }

      // Create batch insert data
      const sessions = dates.map((date, index) => ({
        cohort_id: cohortId,
        meet_link: meetLink,
        scheduled_at: new Date(
          date.getFullYear(), date.getMonth(), date.getDate(),
          hours, minutes
        ).toISOString(),
        duration_minutes: durationMinutes,
        is_recurring: true,
        recurrence_rule: index === 0 ? recurrenceRule : null, // Only first session stores the rule
      }))

      const created = await createSessionsBatch(sessions)
      return { success: true, data: { sessionIds: created.map(s => s.id) } }
    } catch {
      return { success: false, error: 'Invalid recurrence rule format' }
    }
  } else {
    // Single session
    const session = await createSession({
      cohortId,
      meetLink,
      scheduledAt,
      durationMinutes,
      isRecurring: false,
      recurrenceRule: null,
    })

    return { success: true, data: { sessionIds: [session.id] } }
  }
}

export async function cancelSessionAction(
  sessionId: string
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }

  const session = await getSessionById(sessionId)
  if (!session) return { success: false, error: 'Session not found' }

  // Verify ownership via cohort
  const cohort = await getCohortById(session.cohort_id)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Session not found' }
  }

  if (cohort.status === 'archived') {
    return { success: false, error: 'This cohort is archived. No changes allowed.', code: 'COHORT_ARCHIVED' }
  }

  if (session.cancelled_at) {
    return { success: false, error: 'Session is already cancelled' }
  }

  await cancelSession(sessionId)

  return { success: true, data: null }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add lib/actions/class-sessions.ts
git commit -m "feat: add class session server actions with rrule recurring expansion"
```

---

## Task 4: Cohort Components (CohortCard, InviteLinkCopy, SessionCard)

**Files:**
- Create: `components/teacher/CohortCard.tsx`
- Create: `components/teacher/InviteLinkCopy.tsx`
- Create: `components/teacher/SessionCard.tsx`

- [ ] **Step 1: Create CohortCard**

```typescript
// components/teacher/CohortCard.tsx
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatPKT } from '@/lib/time/pkt'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'

type CohortCardProps = {
  cohort: {
    id: string
    name: string
    status: string
    start_date: string
    end_date: string
    fee_pkr: number
    fee_type: string
    max_students: number | null
    is_registration_open: boolean
  }
  courseId: string
  displayStatus: string
  enrollmentCount: number
}

export function CohortCard({ cohort, courseId, displayStatus, enrollmentCount }: CohortCardProps) {
  return (
    <Link href={ROUTES.TEACHER.cohortDetail(courseId, cohort.id)}>
      <Card hover className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-ink">{cohort.name}</h4>
            <p className="mt-0.5 text-sm text-muted">
              {formatPKT(cohort.start_date, 'date')} — {formatPKT(cohort.end_date, 'date')}
            </p>
            <p className="mt-1 text-sm text-muted">
              Rs. {cohort.fee_pkr.toLocaleString()} ({cohort.fee_type === 'monthly' ? 'Monthly' : 'One-time'})
              {' · '}
              {enrollmentCount}{cohort.max_students ? `/${cohort.max_students}` : ''} students
            </p>
          </div>
          <StatusBadge status={displayStatus} />
        </div>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 2: Create InviteLinkCopy**

```typescript
// components/teacher/InviteLinkCopy.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { teacherSubdomainUrl } from '@/lib/platform/domain'
import { useTeacherContext } from '@/providers/TeacherProvider'
import { completeOnboardingStep } from '@/lib/actions/onboarding'

type InviteLinkCopyProps = {
  inviteToken: string
}

export function InviteLinkCopy({ inviteToken }: InviteLinkCopyProps) {
  const { teacher } = useTeacherContext()
  const [copied, setCopied] = useState(false)

  const url = teacherSubdomainUrl(teacher.subdomain, `/join/${inviteToken}`)

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)

    // Fire onboarding step
    await completeOnboardingStep('link_shared')
  }

  return (
    <div className="flex items-center gap-3">
      <input
        type="text"
        readOnly
        value={url}
        className="flex-1 rounded-md border border-border bg-paper px-3 py-2 text-sm text-muted"
      />
      <Button
        variant={copied ? 'secondary' : 'primary'}
        size="sm"
        onClick={handleCopy}
      >
        {copied ? 'Copied!' : 'Copy Link'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Create SessionCard**

```typescript
// components/teacher/SessionCard.tsx
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatPKT } from '@/lib/time/pkt'

type SessionCardProps = {
  session: {
    id: string
    meet_link: string
    scheduled_at: string
    duration_minutes: number
    cancelled_at: string | null
  }
  onCancel?: (sessionId: string) => void
}

export function SessionCard({ session, onCancel }: SessionCardProps) {
  const isCancelled = !!session.cancelled_at
  const isPast = new Date(session.scheduled_at) < new Date()

  return (
    <Card className={`p-4 ${isCancelled ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-ink">
            {formatPKT(session.scheduled_at, 'datetime')}
          </p>
          <p className="text-sm text-muted">
            {session.duration_minutes} min
            {!isCancelled && !isPast && session.meet_link && (
              <>
                {' · '}
                <a
                  href={session.meet_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:text-brand-500"
                >
                  Join Meet
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isCancelled && <StatusBadge status="cancelled" size="sm" />}
          {isPast && !isCancelled && <StatusBadge status="completed" size="sm" />}
          {!isPast && !isCancelled && onCancel && (
            <button
              onClick={() => onCancel(session.id)}
              className="text-sm text-danger hover:text-danger/80"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}
```

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add components/teacher/CohortCard.tsx components/teacher/InviteLinkCopy.tsx components/teacher/SessionCard.tsx
git commit -m "feat: add CohortCard, InviteLinkCopy, and SessionCard components"
```

---

## Task 5: Course Detail Page Update + Cohort Pages

**Files:**
- Modify: `app/(teacher)/dashboard/courses/[courseId]/page.tsx` — Add cohort list
- Create: `app/(teacher)/dashboard/courses/[courseId]/cohorts/new/page.tsx`
- Create: `app/(teacher)/dashboard/courses/[courseId]/cohorts/new/form.tsx`
- Create: `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/page.tsx`
- Create: `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/edit/page.tsx`
- Create: `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/edit/form.tsx`

These pages follow the same pattern as course pages: Server Component page + client form.

The course detail page should show the list of cohorts with CohortCard. Each cohort links to its detail page.

The cohort create form needs: name, start_date, end_date, fee_type (dropdown), fee_pkr, billing_day (shown only if monthly), max_students (optional), registration open toggle, waitlist toggle, pending visibility toggles.

The cohort detail page shows: info, invite link (InviteLinkCopy), and links to schedule/edit.

The cohort edit form mirrors create form but pre-filled, plus archive button.

All pages use `params: Promise<{ courseId: string }>` (Next.js 16 async params).

- [ ] **Step 1-6: Create all cohort pages** (implement as a batch — read existing course page patterns, use CohortCard, InviteLinkCopy, all Server Components with client forms)

- [ ] **Step 7: Verify and commit**

```bash
git add app/\(teacher\)/dashboard/courses/\[courseId\]/
git commit -m "feat: add cohort CRUD pages with create, detail, edit, and invite link"
```

---

## Task 6: Class Schedule Page

**Files:**
- Create: `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/schedule/page.tsx`
- Create: `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/schedule/form.tsx`

The schedule page shows all sessions for a cohort using SessionCard, plus a form to add new sessions (single or recurring).

For recurring sessions: dropdown for frequency (Daily, Weekly), day checkboxes (Mon-Sun for weekly), Meet link input. Uses rrule to build the RRULE string.

- [ ] **Step 1-3: Create schedule page and session create form**

- [ ] **Step 4: Verify and commit**

```bash
git add app/\(teacher\)/dashboard/courses/\[courseId\]/cohorts/\[cohortId\]/schedule/
git commit -m "feat: add class session schedule page with single and recurring creation"
```

---

## Task 7: Public Enrollment Page

**Files:**
- Create: `app/(teacher-public)/[subdomain]/join/[token]/page.tsx`

The public enrollment page at `/join/[token]` has 3 states:
1. **Enrollment form** — course published + cohort active/open + registration open
2. **Coming Soon** — cohort or course is draft
3. **Registration Closed** — registration closed (optionally show waitlist form if enabled)

This page is public (no auth required to view). Actual enrollment requires auth (Week 4).

- [ ] **Step 1: Create public enrollment page**

```typescript
// app/(teacher-public)/[subdomain]/join/[token]/page.tsx
import { notFound } from 'next/navigation'
import { getCohortByInviteToken, getActiveEnrollmentCount, computeCohortDisplayStatus } from '@/lib/db/cohorts'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatPKT } from '@/lib/time/pkt'

export default async function JoinCohortPage({
  params,
}: {
  params: Promise<{ subdomain: string; token: string }>
}) {
  const { token } = await params

  const cohortData = await getCohortByInviteToken(token)
  if (!cohortData) notFound()

  const cohort = cohortData
  const course = cohortData.courses as { id: string; title: string; description: string | null; status: string; thumbnail_url: string | null; teacher_id: string }

  // State 2: Coming Soon
  if (course.status === 'draft' || cohort.status === 'draft') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Card className="p-8">
          <h1 className="text-2xl font-bold text-ink mb-2">Coming Soon</h1>
          <p className="text-muted">
            This course is being prepared. Check back soon for enrollment details.
          </p>
        </Card>
      </div>
    )
  }

  const enrollmentCount = await getActiveEnrollmentCount(cohort.id)
  const displayStatus = computeCohortDisplayStatus(cohort, enrollmentCount)

  // State 3: Registration Closed
  if (!cohort.is_registration_open || displayStatus === 'closed') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Card className="p-8">
          <h1 className="text-2xl font-bold text-ink mb-2">Registration Closed</h1>
          <p className="text-muted mb-4">
            Registration for <strong>{cohort.name}</strong> is currently closed.
          </p>
          {cohort.waitlist_enabled && (
            <p className="text-sm text-muted">
              Waitlist will be available soon.
            </p>
          )}
        </Card>
      </div>
    )
  }

  // State 3b: Full
  if (displayStatus === 'full') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Card className="p-8">
          <h1 className="text-2xl font-bold text-ink mb-2">Cohort Full</h1>
          <p className="text-muted mb-4">
            <strong>{cohort.name}</strong> has reached its student limit.
          </p>
          {cohort.waitlist_enabled && (
            <p className="text-sm text-muted">
              Waitlist will be available soon.
            </p>
          )}
        </Card>
      </div>
    )
  }

  // State 1: Enrollment Form (actual enrollment logic is Week 4)
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card className="p-8">
        {course.thumbnail_url && (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full rounded-lg mb-6"
          />
        )}

        <h1 className="text-2xl font-bold text-ink">{course.title}</h1>
        <h2 className="text-lg text-muted mt-1">{cohort.name}</h2>

        <div className="mt-4 space-y-2 text-sm text-muted">
          <p>{formatPKT(cohort.start_date, 'date')} — {formatPKT(cohort.end_date, 'date')}</p>
          <p className="text-lg font-semibold text-ink">
            Rs. {cohort.fee_pkr.toLocaleString()}
            {cohort.fee_type === 'monthly' ? '/month' : ' (one-time)'}
          </p>
          {cohort.max_students && (
            <p>{enrollmentCount}/{cohort.max_students} spots filled</p>
          )}
        </div>

        <div className="mt-6">
          <Button className="w-full" size="lg">
            Enroll Now
          </Button>
          <p className="mt-2 text-xs text-muted text-center">
            You&apos;ll need to create an account or log in to enroll.
          </p>
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify and commit**

```bash
git add app/\(teacher-public\)/\[subdomain\]/join/
git commit -m "feat: add public enrollment page with 3 states (form, coming soon, closed)"
```

---

## Task 8: Archive Cohorts Cron Job

**Files:**
- Create: `app/api/cron/archive-cohorts/route.ts`

- [ ] **Step 1: Create cron route**

```typescript
// app/api/cron/archive-cohorts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/supabase/server'

export async function GET(request: NextRequest) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Find cohorts past end_date that aren't archived
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id')
    .lt('end_date', today)
    .neq('status', 'archived')
    .is('deleted_at', null)

  if (!cohorts || cohorts.length === 0) {
    return NextResponse.json({ success: true, archived: 0 })
  }

  const cohortIds = cohorts.map(c => c.id)

  // Archive all expired cohorts
  await supabase
    .from('cohorts')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
      is_registration_open: false,
      updated_at: new Date().toISOString(),
    })
    .in('id', cohortIds)

  // Auto-reject pending enrollments
  await supabase
    .from('enrollments')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .in('cohort_id', cohortIds)
    .eq('status', 'pending')

  // Expire waitlist entries
  await supabase
    .from('cohort_waitlist')
    .update({ status: 'expired' })
    .in('cohort_id', cohortIds)
    .eq('status', 'waiting')

  return NextResponse.json({ success: true, archived: cohortIds.length })
}
```

- [ ] **Step 2: Verify and commit**

```bash
git add app/api/cron/archive-cohorts/route.ts
git commit -m "feat: add archive-cohorts cron job with auto-reject and waitlist expiry"
```

---

## Task 9: Final Integration + Verification

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```
Fix any errors.

- [ ] **Step 2: Test dev server**

```bash
timeout 15 npm run dev 2>&1
```
Verify it starts.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Week 3 — cohorts, class scheduling, public enrollment, cron"
```

---

## Post-Implementation Verification

1. `npx tsc --noEmit` — zero errors
2. Course detail page shows cohort list
3. Cohort creation enforces plan limits (max_cohorts_active)
4. billing_day validates 1-28 for monthly cohorts
5. Invite link copy fires onboarding step 'link_shared'
6. Public `/join/[token]` shows 3 states correctly
7. Recurring session creation expands all dates via rrule
8. Session cancellation works
9. Archive sets status='archived', rejects pending enrollments, expires waitlist
10. Cron validates CRON_SECRET header
11. Archived cohort blocks all writes (COHORT_ARCHIVED error)
12. All mutations verify teacher ownership
