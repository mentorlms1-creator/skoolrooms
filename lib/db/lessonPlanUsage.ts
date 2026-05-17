// =============================================================================
// lib/db/lessonPlanUsage.ts — Usage event log + monthly quota counter
// =============================================================================

import { createAdminClient } from '@/supabase/server'
import type { Database } from '@/types/database'

export type LessonPlanUsageInsert =
  Database['public']['Tables']['lesson_plan_usage']['Insert']

// -----------------------------------------------------------------------------
// insertUsageEvent — Log a generate / revise event for a teacher
// -----------------------------------------------------------------------------
export async function insertUsageEvent(
  row: LessonPlanUsageInsert
): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase.from('lesson_plan_usage').insert(row)
  if (error) throw error
}

// -----------------------------------------------------------------------------
// countGenerationsThisMonth — Count of `generate` events since PKT month start
// PKT is UTC+5; we compute the month boundary in JS to avoid relying on a
// Postgres function. Comparison against `created_at` (timestamptz) is UTC.
// -----------------------------------------------------------------------------
export async function countGenerationsThisMonth(
  teacherId: string
): Promise<number> {
  const supabase = createAdminClient()

  const PKT_OFFSET_MS = 5 * 60 * 60 * 1000
  const nowUtc = Date.now()
  const pktNow = new Date(nowUtc + PKT_OFFSET_MS)
  // Build the PKT calendar month-start, then convert back to UTC for the query.
  const pktMonthStart = Date.UTC(
    pktNow.getUTCFullYear(),
    pktNow.getUTCMonth(),
    1
  )
  const monthStartUtcIso = new Date(pktMonthStart - PKT_OFFSET_MS).toISOString()

  const { count, error } = await supabase
    .from('lesson_plan_usage')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('event', 'generate')
    .gte('created_at', monthStartUtcIso)

  if (error) throw error
  return count ?? 0
}
