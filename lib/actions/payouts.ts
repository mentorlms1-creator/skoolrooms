'use server'

// =============================================================================
// lib/actions/payouts.ts — Server Action for teacher payout requests
// Business rules:
//   - Balance >= min_payout_amount_pkr (from platform_settings)
//   - Bank details must be set
//   - No existing pending/processing payout
//   - Deducts from available_balance, adds to pending_balance
// =============================================================================

import { createClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { getTeacherBalance, hasActivePayout, createPayoutRequest } from '@/lib/db/balances'
import { getTeacherPaymentSettings } from '@/lib/db/admin'
import { getMinPayoutAmount } from '@/lib/platform/settings'
import { revalidatePath } from 'next/cache'
import type { ApiResponse } from '@/types/api'

// -----------------------------------------------------------------------------
// requestPayoutAction — Request a payout from available balance
// -----------------------------------------------------------------------------
export async function requestPayoutAction(
  formData: FormData
): Promise<ApiResponse<{ payoutId: string }>> {
  // 1. Authenticate
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  const teacher = await getTeacherByAuthId(user.id)
  if (!teacher) {
    return { success: false, error: 'Teacher not found' }
  }

  // 2. Parse and validate amount
  const amountRaw = formData.get('amount') as string | null
  if (!amountRaw) {
    return { success: false, error: 'Amount is required' }
  }

  const amount = parseInt(amountRaw, 10)
  if (isNaN(amount) || amount <= 0) {
    return { success: false, error: 'Invalid amount' }
  }

  // 3. Check bank details are set
  const paymentSettings = await getTeacherPaymentSettings(teacher.id)
  const hasBankDetails =
    paymentSettings &&
    (paymentSettings.payout_iban ||
      paymentSettings.jazzcash_number ||
      paymentSettings.easypaisa_number)

  if (!hasBankDetails) {
    return {
      success: false,
      error: 'Please set up your payment details in Settings before requesting a payout.',
      code: 'NO_BANK_DETAILS',
    }
  }

  // 4. Check no active payout exists
  const activePayout = await hasActivePayout(teacher.id)
  if (activePayout) {
    return {
      success: false,
      error: 'You already have a pending payout request. Please wait for it to be processed.',
      code: 'ACTIVE_PAYOUT_EXISTS',
    }
  }

  // 5. Check balance >= amount and amount >= minimum
  const balance = await getTeacherBalance(teacher.id)
  const minPayout = await getMinPayoutAmount()

  if (amount > balance.available_balance_pkr) {
    return {
      success: false,
      error: `Requested amount exceeds your available balance of PKR ${balance.available_balance_pkr.toLocaleString()}.`,
      code: 'INSUFFICIENT_BALANCE',
    }
  }

  if (amount < minPayout) {
    return {
      success: false,
      error: `Minimum payout amount is PKR ${minPayout.toLocaleString()}.`,
      code: 'BELOW_MINIMUM',
    }
  }

  // 6. Build bank details snapshot
  const bankSnapshot: Record<string, unknown> = {
    bank_name: paymentSettings.payout_bank_name,
    account_title: paymentSettings.payout_account_title,
    iban: paymentSettings.payout_iban,
    jazzcash_number: paymentSettings.jazzcash_number,
    easypaisa_number: paymentSettings.easypaisa_number,
  }

  // 7. Create the payout request
  const payout = await createPayoutRequest(teacher.id, amount, bankSnapshot)
  if (!payout) {
    return {
      success: false,
      error: 'Failed to create payout request. Please try again.',
    }
  }

  revalidatePath('/dashboard/earnings')
  return { success: true, data: { payoutId: payout.id } }
}
