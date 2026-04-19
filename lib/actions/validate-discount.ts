'use server'

// =============================================================================
// lib/actions/validate-discount.ts — Public Server Action to validate discount codes
// Callable from any Client Component on the pay page (no API route needed)
// =============================================================================

import { getDiscountCodeByCohortAndCode } from '@/lib/db/discount-codes'
import { getCohortById } from '@/lib/db/cohorts'

export type ValidateDiscountResult =
  | { valid: true; discountedAmountPkr: number; type: string; value: number; codeId: string }
  | { valid: false; error: string }

// -----------------------------------------------------------------------------
// validateDiscountAction — Validates a discount code for a cohort
// Does NOT call increment_discount_use() — that happens at approval time
// -----------------------------------------------------------------------------
export async function validateDiscountAction(
  cohortId: string,
  code: string
): Promise<ValidateDiscountResult> {
  if (!cohortId || !code?.trim()) {
    return { valid: false, error: 'Invalid input.' }
  }

  const discountCode = await getDiscountCodeByCohortAndCode(cohortId, code.trim())

  if (!discountCode) {
    return { valid: false, error: 'Invalid discount code.' }
  }

  // Check expiry
  if (discountCode.expires_at && new Date(discountCode.expires_at) < new Date()) {
    return { valid: false, error: 'This discount code has expired.' }
  }

  // Check max uses
  if (
    discountCode.max_uses !== null &&
    discountCode.use_count >= discountCode.max_uses
  ) {
    return { valid: false, error: 'This discount code is no longer available.' }
  }

  // Fetch cohort fee to compute discounted amount
  const cohort = await getCohortById(cohortId)
  if (!cohort) {
    return { valid: false, error: 'Cohort not found.' }
  }

  let discountedAmountPkr: number
  if (discountCode.discount_type === 'fixed') {
    discountedAmountPkr = cohort.fee_pkr - discountCode.discount_value
  } else {
    // percent
    discountedAmountPkr = Math.floor(
      cohort.fee_pkr * (1 - discountCode.discount_value / 100)
    )
  }

  // Minimum Rs. 1
  discountedAmountPkr = Math.max(1, discountedAmountPkr)

  return {
    valid: true,
    discountedAmountPkr,
    type: discountCode.discount_type,
    value: discountCode.discount_value,
    codeId: discountCode.id,
  }
}
