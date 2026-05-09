// =============================================================================
// lib/plans/limits.ts — Plan limit checks with grandfathering support
// Checks teacher_plan_snapshot first (for grandfathered limits),
// then falls back to the live plans table.
// =============================================================================

import { createAdminClient } from '@/supabase/server'
import { getEffectivePlan } from '@/lib/auth/plan-state'
import type { LimitKey } from '@/types/domain'

/**
 * Returns the effective limit for a teacher on a given limit key.
 *
 * Logic:
 * 1. Look up teacher_plan_snapshot for this teacher.
 *    If snapshot exists and the limit in snapshot_json.limits is MORE generous
 *    (higher number) than the live plan limit, return the snapshot value
 *    (grandfathered).
 * 2. Otherwise, return the live plan limit from the plans table.
 *
 * Returns the numeric limit. A very high number effectively means unlimited,
 * but the plans table always has concrete values.
 */
export async function getLimit(
  teacherId: string,
  limitKey: LimitKey,
): Promise<number> {
  const supabase = createAdminClient()

  // Get the teacher's current plan + downgrade fields. Use effective plan so a
  // soft-downgraded teacher is treated as Free even if the cron hasn't yet
  // flipped plan='free' in the row.
  const { data: teacher } = await supabase
    .from('teachers')
    .select('plan, plan_expires_at, grace_until, downgraded_at, trial_ends_at')
    .eq('id', teacherId)
    .single()

  if (!teacher) return 0

  const effectivePlan = getEffectivePlan(teacher)

  // Get live plan limits
  const { data: plan } = await supabase
    .from('plans')
    .select('max_courses, max_students, max_cohorts_active, max_storage_mb, max_teachers')
    .eq('slug', effectivePlan)
    .single()

  if (!plan) return 0

  // Map limitKey to the plan column value
  const liveLimitMap: Record<LimitKey, number> = {
    max_courses: plan.max_courses,
    max_students: plan.max_students,
    max_cohorts_active: plan.max_cohorts_active,
    max_storage_mb: plan.max_storage_mb,
    max_teachers: plan.max_teachers,
  }

  const liveLimit = liveLimitMap[limitKey]

  // Check snapshot for grandfathered limits
  const { data: snapshot } = await supabase
    .from('teacher_plan_snapshot')
    .select('snapshot_json')
    .eq('teacher_id', teacherId)
    .single()

  if (snapshot?.snapshot_json) {
    const snapshotData = snapshot.snapshot_json as {
      limits?: Record<string, number>
    }
    if (snapshotData.limits && typeof snapshotData.limits[limitKey] === 'number') {
      const snapshotLimit = snapshotData.limits[limitKey]
      // Grandfathering: use snapshot only if it's MORE generous than live plan
      if (snapshotLimit > liveLimit) {
        return snapshotLimit
      }
    }
  }

  return liveLimit
}
