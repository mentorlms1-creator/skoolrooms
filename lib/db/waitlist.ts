// =============================================================================
// lib/db/waitlist.ts — Waitlist CRUD queries (service layer)
// All database queries for cohort_waitlist go through this file.
// =============================================================================

import { createAdminClient } from '@/supabase/server'
import type { WaitlistStatus } from '@/types/domain'

// -----------------------------------------------------------------------------
// Row types (mirrors the cohort_waitlist table from 001_initial_schema.sql)
// -----------------------------------------------------------------------------

export type WaitlistRow = {
  id: string
  cohort_id: string
  student_id: string | null
  student_name: string
  student_phone: string
  student_email: string
  joined_at: string
  status: string
  teacher_note: string | null
}

// Waitlist entry with computed position
export type WaitlistEntryWithPosition = WaitlistRow & {
  position: number
}

// Input type for joining waitlist
export type JoinWaitlistInput = {
  cohortId: string
  studentName: string
  studentPhone: string
  studentEmail: string
  studentId?: string
}

// -----------------------------------------------------------------------------
// joinWaitlist — Insert a waitlist entry with status='waiting'
// UNIQUE(cohort_id, student_email) is enforced by the DB
// -----------------------------------------------------------------------------
export async function joinWaitlist(
  input: JoinWaitlistInput,
): Promise<WaitlistRow | null> {
  const supabase = createAdminClient()

  const insertData: Record<string, unknown> = {
    cohort_id: input.cohortId,
    student_name: input.studentName,
    student_phone: input.studentPhone,
    student_email: input.studentEmail,
    status: 'waiting' satisfies WaitlistStatus,
  }

  if (input.studentId) {
    insertData.student_id = input.studentId
  }

  const { data, error } = await supabase
    .from('cohort_waitlist')
    .insert(insertData)
    .select('*')
    .single()

  if (error || !data) return null
  return data as WaitlistRow
}

// -----------------------------------------------------------------------------
// leaveWaitlist — Set status='removed' for a specific cohort+email
// -----------------------------------------------------------------------------
export async function leaveWaitlist(
  cohortId: string,
  studentEmail: string,
): Promise<boolean> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('cohort_waitlist')
    .update({ status: 'removed' satisfies WaitlistStatus })
    .eq('cohort_id', cohortId)
    .eq('student_email', studentEmail)
    .eq('status', 'waiting')

  return !error
}

// -----------------------------------------------------------------------------
// getWaitlistByCohort — List all waiting entries with position (ordered by joined_at)
// -----------------------------------------------------------------------------
export async function getWaitlistByCohort(
  cohortId: string,
): Promise<WaitlistEntryWithPosition[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cohort_waitlist')
    .select('*')
    .eq('cohort_id', cohortId)
    .eq('status', 'waiting')
    .order('joined_at', { ascending: true })

  if (error || !data) return []

  return (data as WaitlistRow[]).map((entry, index) => ({
    ...entry,
    position: index + 1,
  }))
}

// -----------------------------------------------------------------------------
// getWaitlistEntry — Check if a specific email is already on the waitlist
// Returns the entry regardless of status (to show proper messaging)
// -----------------------------------------------------------------------------
export async function getWaitlistEntry(
  cohortId: string,
  studentEmail: string,
): Promise<WaitlistRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cohort_waitlist')
    .select('*')
    .eq('cohort_id', cohortId)
    .eq('student_email', studentEmail)
    .single()

  if (error || !data) return null
  return data as WaitlistRow
}
