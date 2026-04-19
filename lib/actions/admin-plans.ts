'use server'

// =============================================================================
// lib/actions/admin-plans.ts — Plan CRUD Server Actions
// =============================================================================

import { requireAdmin } from '@/lib/auth/guards'
import { logAdminActivity } from '@/lib/db/admin'
import {
  createPlan,
  updatePlan,
  archivePlan,
  deletePlan,
  type CreatePlanInput,
  type UpdatePlanInput,
} from '@/lib/db/admin-plans'
import { revalidatePath } from 'next/cache'
import type { ApiResponse } from '@/types/api'
import type { PlanRow } from '@/lib/db/admin-plans'

export async function createPlanAction(
  input: CreatePlanInput
): Promise<ApiResponse<PlanRow>> {
  const admin = await requireAdmin()

  if (!input.name?.trim() || !input.slug?.trim()) {
    return { success: false, error: 'Name and slug are required.' }
  }
  if (!/^[a-z0-9-]+$/.test(input.slug)) {
    return { success: false, error: 'Slug must be lowercase letters, numbers, and hyphens only.' }
  }

  const plan = await createPlan(input)
  if (!plan) {
    return { success: false, error: 'Failed to create plan. Slug may already exist.' }
  }

  await logAdminActivity({
    actionType: 'create_plan',
    performedBy: admin.email ?? admin.id,
    metadata: { plan_id: plan.id, slug: plan.slug, name: plan.name },
  })

  revalidatePath('/admin/plans')
  return { success: true, data: plan }
}

export async function updatePlanAction(
  planId: string,
  input: UpdatePlanInput
): Promise<ApiResponse<{ plan: PlanRow; affectedCount: number }>> {
  const admin = await requireAdmin()

  const result = await updatePlan(planId, input)
  if (!result) {
    return { success: false, error: 'Failed to update plan. Plan may not exist.' }
  }

  await logAdminActivity({
    actionType: 'update_plan',
    performedBy: admin.email ?? admin.id,
    metadata: {
      plan_id: planId,
      updated_fields: Object.keys(input),
      grandfathered_count: result.affectedCount,
    },
  })

  revalidatePath('/admin/plans')
  revalidatePath(`/admin/plans/${planId}`)
  return { success: true, data: result }
}

export async function archivePlanAction(planId: string): Promise<ApiResponse<null>> {
  const admin = await requireAdmin()

  const success = await archivePlan(planId)
  if (!success) {
    return { success: false, error: 'Failed to archive plan.' }
  }

  await logAdminActivity({
    actionType: 'archive_plan',
    performedBy: admin.email ?? admin.id,
    metadata: { plan_id: planId },
  })

  revalidatePath('/admin/plans')
  return { success: true, data: null }
}

export async function deletePlanAction(planId: string): Promise<ApiResponse<null>> {
  const admin = await requireAdmin()

  const result = await deletePlan(planId)
  if (!result.success) {
    if (result.error === 'PLAN_HAS_SUBSCRIBERS') {
      return { success: false, error: 'Cannot delete plan with active subscribers.' }
    }
    return { success: false, error: 'Failed to delete plan.' }
  }

  await logAdminActivity({
    actionType: 'delete_plan',
    performedBy: admin.email ?? admin.id,
    metadata: { plan_id: planId },
  })

  revalidatePath('/admin/plans')
  return { success: true, data: null }
}
