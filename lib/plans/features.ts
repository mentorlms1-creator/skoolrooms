// =============================================================================
// lib/plans/features.ts — Feature access checks with grandfathering support
// Checks teacher_plan_snapshot first (for grandfathered features),
// then falls back to the live plan_features table.
// =============================================================================

import { createAdminClient } from '@/supabase/server'
import type { FeatureKey } from '@/types/domain'

/**
 * Checks whether a teacher can use a specific feature.
 *
 * Logic:
 * 1. Look up teacher_plan_snapshot for this teacher.
 *    If snapshot exists and the feature is enabled in snapshot_json.features,
 *    return true (grandfathered).
 * 2. Otherwise, look up the teacher's current plan and check plan_features.
 *
 * This ensures that if a plan's features are later reduced, teachers who
 * subscribed when those features were included retain access.
 */
export async function canUseFeature(
  teacherId: string,
  featureKey: FeatureKey,
): Promise<boolean> {
  const supabase = await createAdminClient()

  // Step 1: Check snapshot (grandfathered features)
  const { data: snapshot } = await supabase
    .from('teacher_plan_snapshot')
    .select('snapshot_json')
    .eq('teacher_id', teacherId)
    .single()

  if (snapshot?.snapshot_json) {
    const snapshotData = snapshot.snapshot_json as {
      features?: Record<string, boolean>
    }
    if (snapshotData.features && snapshotData.features[featureKey] === true) {
      return true
    }
  }

  // Step 2: Fall back to live plan_features table
  const { data: teacher } = await supabase
    .from('teachers')
    .select('plan')
    .eq('id', teacherId)
    .single()

  if (!teacher) return false

  const { data: planRow } = await supabase
    .from('plans')
    .select('id')
    .eq('slug', teacher.plan)
    .single()

  if (!planRow) return false

  const { data: feature } = await supabase
    .from('plan_features')
    .select('is_enabled')
    .eq('plan_id', planRow.id)
    .eq('feature_key', featureKey)
    .single()

  return feature?.is_enabled === true
}
