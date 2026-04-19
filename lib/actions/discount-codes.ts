'use server'

// =============================================================================
// lib/actions/discount-codes.ts — Server actions for discount code CRUD
// =============================================================================

import { createClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { getCohortById } from '@/lib/db/cohorts'
import { canUseFeature } from '@/lib/plans/features'
import {
  createDiscountCode,
  updateDiscountCode,
  deleteDiscountCode,
  getDiscountCodeById,
} from '@/lib/db/discount-codes'
import { revalidatePath } from 'next/cache'
import type { ApiResponse } from '@/types/api'
import { FeatureKey } from '@/types/domain'

// Safe charset — no 0/O/1/I/L to avoid confusion (matches reference code format)
const CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function validateDiscountCode(code: string): boolean {
  if (code.length < 6 || code.length > 8) return false
  return /^[A-Z0-9]+$/.test(code)
}

async function getAuthenticatedTeacher() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return getTeacherByAuthId(user.id)
}

// -----------------------------------------------------------------------------
// createDiscountCodeAction — Teacher creates a new discount code
// -----------------------------------------------------------------------------
export async function createDiscountCodeAction(
  formData: FormData
): Promise<ApiResponse<{ id: string }>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }

  // Feature gate: only teachers with discount_codes feature can use this
  const hasFeature = await canUseFeature(teacher.id, FeatureKey.DISCOUNT_CODES)
  if (!hasFeature) {
    return {
      success: false,
      error: 'Discount codes are not available on your current plan.',
      code: 'FEATURE_LOCKED',
    }
  }

  const cohortId = (formData.get('cohort_id') as string | null)?.trim() ?? ''
  const codeRaw = (formData.get('code') as string | null)?.trim().toUpperCase() ?? ''
  const discountType = (formData.get('discount_type') as string | null)?.trim() ?? ''
  const discountValueRaw = formData.get('discount_value') as string | null
  const maxUsesRaw = formData.get('max_uses') as string | null
  const expiresAtRaw = formData.get('expires_at') as string | null

  if (!cohortId) return { success: false, error: 'Cohort is required.' }
  if (!codeRaw) return { success: false, error: 'Discount code is required.' }

  if (!validateDiscountCode(codeRaw)) {
    return {
      success: false,
      error: 'Code must be 6–8 uppercase alphanumeric characters (no spaces).',
    }
  }

  if (!['fixed', 'percent'].includes(discountType)) {
    return { success: false, error: 'Discount type must be fixed or percent.' }
  }

  const discountValue = discountValueRaw ? parseInt(discountValueRaw, 10) : NaN
  if (isNaN(discountValue) || discountValue <= 0) {
    return { success: false, error: 'Discount value must be a positive number.' }
  }

  if (discountType === 'percent' && discountValue > 100) {
    return { success: false, error: 'Percent discount cannot exceed 100.' }
  }

  // Verify cohort ownership
  const cohort = await getCohortById(cohortId)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Cohort not found.' }
  }

  if (cohort.status === 'archived') {
    return { success: false, error: 'Cannot add discount codes to an archived cohort.' }
  }

  if (discountType === 'fixed' && discountValue >= cohort.fee_pkr) {
    return {
      success: false,
      error: `Fixed discount must be less than the cohort fee (Rs. ${cohort.fee_pkr}).`,
    }
  }

  const maxUses = maxUsesRaw && maxUsesRaw !== '' ? parseInt(maxUsesRaw, 10) : null
  if (maxUses !== null && (isNaN(maxUses) || maxUses < 1)) {
    return { success: false, error: 'Max uses must be at least 1.' }
  }

  const expiresAt =
    expiresAtRaw && expiresAtRaw !== ''
      ? new Date(expiresAtRaw).toISOString()
      : null

  const code = await createDiscountCode({
    teacherId: teacher.id,
    cohortId,
    code: codeRaw,
    discountType: discountType as 'fixed' | 'percent',
    discountValue,
    maxUses,
    expiresAt,
  })

  if (!code) {
    // Could be a unique constraint violation (duplicate code for cohort)
    return {
      success: false,
      error:
        'Failed to create discount code. The code may already exist for this cohort.',
    }
  }

  revalidatePath(
    `/dashboard/courses/${cohort.course_id}/cohorts/${cohortId}/discount-codes`
  )

  return { success: true, data: { id: code.id } }
}

// -----------------------------------------------------------------------------
// updateDiscountCodeAction — Teacher updates an existing discount code
// -----------------------------------------------------------------------------
export async function updateDiscountCodeAction(
  codeId: string,
  formData: FormData
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }

  const existing = await getDiscountCodeById(codeId)
  if (!existing || existing.teacher_id !== teacher.id) {
    return { success: false, error: 'Discount code not found.' }
  }

  const discountType = (formData.get('discount_type') as string | null)?.trim()
  const discountValueRaw = formData.get('discount_value') as string | null
  const maxUsesRaw = formData.get('max_uses') as string | null
  const expiresAtRaw = formData.get('expires_at') as string | null

  if (discountType && !['fixed', 'percent'].includes(discountType)) {
    return { success: false, error: 'Discount type must be fixed or percent.' }
  }

  const discountValue = discountValueRaw ? parseInt(discountValueRaw, 10) : undefined
  if (discountValue !== undefined && (isNaN(discountValue) || discountValue <= 0)) {
    return { success: false, error: 'Discount value must be a positive number.' }
  }

  if (
    (discountType ?? existing.discount_type) === 'percent' &&
    (discountValue ?? existing.discount_value) > 100
  ) {
    return { success: false, error: 'Percent discount cannot exceed 100.' }
  }

  const maxUses = maxUsesRaw !== null
    ? maxUsesRaw === '' ? null : parseInt(maxUsesRaw, 10)
    : undefined

  if (maxUses !== null && maxUses !== undefined && (isNaN(maxUses) || maxUses < 1)) {
    return { success: false, error: 'Max uses must be at least 1.' }
  }

  const expiresAt =
    expiresAtRaw !== null
      ? expiresAtRaw === '' ? null : new Date(expiresAtRaw).toISOString()
      : undefined

  const updated = await updateDiscountCode(codeId, {
    discountType: discountType as 'fixed' | 'percent' | undefined,
    discountValue,
    ...(maxUses !== undefined ? { maxUses } : {}),
    ...(expiresAt !== undefined ? { expiresAt } : {}),
  })

  if (!updated) return { success: false, error: 'Failed to update discount code.' }

  const cohort = await getCohortById(existing.cohort_id)
  revalidatePath(
    `/dashboard/courses/${cohort?.course_id ?? ''}/cohorts/${existing.cohort_id}/discount-codes`
  )

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// deleteDiscountCodeAction — Teacher deletes a discount code
// -----------------------------------------------------------------------------
export async function deleteDiscountCodeAction(
  codeId: string
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }

  const existing = await getDiscountCodeById(codeId)
  if (!existing || existing.teacher_id !== teacher.id) {
    return { success: false, error: 'Discount code not found.' }
  }

  const success = await deleteDiscountCode(codeId)
  if (!success) return { success: false, error: 'Failed to delete discount code.' }

  const cohort = await getCohortById(existing.cohort_id)
  revalidatePath(
    `/dashboard/courses/${cohort?.course_id ?? ''}/cohorts/${existing.cohort_id}/discount-codes`
  )

  return { success: true, data: null }
}
