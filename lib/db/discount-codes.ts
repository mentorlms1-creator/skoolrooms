// =============================================================================
// lib/db/discount-codes.ts — Discount code CRUD queries (service layer)
// All database queries for discount_codes go through this file.
// =============================================================================

import { createAdminClient } from '@/supabase/server'

export type DiscountCodeRow = {
  id: string
  teacher_id: string
  cohort_id: string
  code: string
  discount_type: string
  discount_value: number
  max_uses: number | null
  use_count: number
  expires_at: string | null
  created_at: string
}

export type CreateDiscountCodeInput = {
  teacherId: string
  cohortId: string
  code: string
  discountType: 'fixed' | 'percent'
  discountValue: number
  maxUses?: number | null
  expiresAt?: string | null
}

export type UpdateDiscountCodeInput = {
  discountType?: 'fixed' | 'percent'
  discountValue?: number
  maxUses?: number | null
  expiresAt?: string | null
}

// -----------------------------------------------------------------------------
// getDiscountCodesByCohort — All discount codes for a cohort
// -----------------------------------------------------------------------------
export async function getDiscountCodesByCohort(
  cohortId: string
): Promise<DiscountCodeRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('discount_codes')
    .select('*')
    .eq('cohort_id', cohortId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as DiscountCodeRow[]
}

// -----------------------------------------------------------------------------
// getDiscountCodeById — Single discount code by ID
// -----------------------------------------------------------------------------
export async function getDiscountCodeById(
  id: string
): Promise<DiscountCodeRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('discount_codes')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as DiscountCodeRow
}

// -----------------------------------------------------------------------------
// getDiscountCodeByCohortAndCode — Case-insensitive lookup by cohort + code
// Used for validation on the pay page
// -----------------------------------------------------------------------------
export async function getDiscountCodeByCohortAndCode(
  cohortId: string,
  code: string
): Promise<DiscountCodeRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('discount_codes')
    .select('*')
    .eq('cohort_id', cohortId)
    .ilike('code', code.trim())
    .single()

  if (error || !data) return null
  return data as DiscountCodeRow
}

// -----------------------------------------------------------------------------
// createDiscountCode — Insert a new discount code
// -----------------------------------------------------------------------------
export async function createDiscountCode(
  input: CreateDiscountCodeInput
): Promise<DiscountCodeRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('discount_codes')
    .insert({
      teacher_id: input.teacherId,
      cohort_id: input.cohortId,
      code: input.code.toUpperCase(),
      discount_type: input.discountType,
      discount_value: input.discountValue,
      max_uses: input.maxUses ?? null,
      expires_at: input.expiresAt ?? null,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return data as DiscountCodeRow
}

// -----------------------------------------------------------------------------
// updateDiscountCode — Update a discount code by ID
// -----------------------------------------------------------------------------
export async function updateDiscountCode(
  id: string,
  input: UpdateDiscountCodeInput
): Promise<DiscountCodeRow | null> {
  const supabase = createAdminClient()

  const updatePayload: Record<string, unknown> = {}
  if (input.discountType !== undefined) updatePayload.discount_type = input.discountType
  if (input.discountValue !== undefined) updatePayload.discount_value = input.discountValue
  if ('maxUses' in input) updatePayload.max_uses = input.maxUses ?? null
  if ('expiresAt' in input) updatePayload.expires_at = input.expiresAt ?? null

  const { data, error } = await supabase
    .from('discount_codes')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) return null
  return data as DiscountCodeRow
}

// -----------------------------------------------------------------------------
// deleteDiscountCode — Delete a discount code by ID
// -----------------------------------------------------------------------------
export async function deleteDiscountCode(id: string): Promise<boolean> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('discount_codes')
    .delete()
    .eq('id', id)

  return !error
}
