'use server'

// =============================================================================
// lib/actions/admin-payouts.ts — Server Actions for admin payout management
// completePayoutAction and failPayoutAction are called from the admin payouts page.
// =============================================================================

import { requireAdmin } from '@/lib/auth/guards'
import { getPayoutById, completePayoutDb, failPayoutDb } from '@/lib/db/payouts'
import { getTeacherPaymentSettings, logAdminActivity } from '@/lib/db/admin'
import { sendEmail } from '@/lib/email/sender'
import { createAdminClient } from '@/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ApiResponse } from '@/types/api'

// -----------------------------------------------------------------------------
// completePayoutAction — Mark a payout as completed
// Reads LIVE bank details at this moment for the audit snapshot.
// Sends payout_processed email to teacher.
// Logs to admin_activity_log.
// -----------------------------------------------------------------------------
export async function completePayoutAction(
  payoutId: string,
  adminNote: string,
): Promise<ApiResponse<null>> {
  const adminUser = await requireAdmin()

  const payoutData = await getPayoutById(payoutId)
  if (!payoutData) {
    return { success: false, error: 'Payout not found.' }
  }

  if (payoutData.payout.status !== 'pending' && payoutData.payout.status !== 'processing') {
    return { success: false, error: 'This payout cannot be completed in its current status.' }
  }

  // Read LIVE bank details at completion time for the audit snapshot
  const liveSettings = await getTeacherPaymentSettings(payoutData.teacher.id)
  const bankSnapshot: Record<string, unknown> = liveSettings
    ? {
        bank_name: liveSettings.payout_bank_name,
        account_title: liveSettings.payout_account_title,
        iban: liveSettings.payout_iban,
        jazzcash_number: liveSettings.jazzcash_number,
        easypaisa_number: liveSettings.easypaisa_number,
        snapshot_taken_at: new Date().toISOString(),
      }
    : { snapshot_taken_at: new Date().toISOString(), note: 'No payment settings found' }

  const success = await completePayoutDb(payoutId, adminNote, bankSnapshot)
  if (!success) {
    return { success: false, error: 'Failed to complete payout. Please try again.' }
  }

  // Send payout_processed email to teacher
  if (payoutData.teacher.email) {
    await sendEmail({
      to: payoutData.teacher.email,
      type: 'payout_processed',
      recipientId: payoutData.teacher.id,
      recipientType: 'teacher',
      data: {
        teacherName: payoutData.teacher.name,
        amountPkr: payoutData.payout.amount_pkr,
        payoutId,
        adminNote: adminNote || undefined,
        bankDetails: liveSettings?.payout_iban
          ? `IBAN: ${liveSettings.payout_iban}`
          : liveSettings?.jazzcash_number
            ? `JazzCash: ${liveSettings.jazzcash_number}`
            : liveSettings?.easypaisa_number
              ? `EasyPaisa: ${liveSettings.easypaisa_number}`
              : 'Bank details on file',
      },
    })
  }

  await logAdminActivity({
    teacherId: payoutData.teacher.id,
    actionType: 'payout_completed',
    performedBy: adminUser.email ?? adminUser.id,
    metadata: {
      payoutId,
      amountPkr: payoutData.payout.amount_pkr,
      adminNote: adminNote || null,
    },
  })

  revalidatePath('/admin/payouts')
  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// failPayoutAction — Mark a payout as failed, restore teacher's available balance
// Sends payout_failed email to teacher.
// Logs to admin_activity_log.
// -----------------------------------------------------------------------------
export async function failPayoutAction(
  payoutId: string,
  adminNote: string,
): Promise<ApiResponse<null>> {
  const adminUser = await requireAdmin()

  const payoutData = await getPayoutById(payoutId)
  if (!payoutData) {
    return { success: false, error: 'Payout not found.' }
  }

  if (payoutData.payout.status !== 'pending' && payoutData.payout.status !== 'processing') {
    return { success: false, error: 'This payout cannot be failed in its current status.' }
  }

  const success = await failPayoutDb(payoutId, adminNote)
  if (!success) {
    return { success: false, error: 'Failed to mark payout as failed. Please try again.' }
  }

  // Send payout_failed email to teacher
  if (payoutData.teacher.email) {
    await sendEmail({
      to: payoutData.teacher.email,
      type: 'payout_failed',
      recipientId: payoutData.teacher.id,
      recipientType: 'teacher',
      data: {
        teacherName: payoutData.teacher.name,
        amountPkr: payoutData.payout.amount_pkr,
        payoutId,
        adminNote: adminNote || 'No reason provided',
      },
    })
  }

  await logAdminActivity({
    teacherId: payoutData.teacher.id,
    actionType: 'payout_failed',
    performedBy: adminUser.email ?? adminUser.id,
    metadata: {
      payoutId,
      amountPkr: payoutData.payout.amount_pkr,
      adminNote: adminNote || null,
    },
  })

  revalidatePath('/admin/payouts')
  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// clearTeacherDebitAction — Admin manually forgives a teacher's outstanding debit
// Sets outstanding_debit_pkr = 0. Logs to admin_activity_log.
// -----------------------------------------------------------------------------
export async function clearTeacherDebitAction(
  teacherId: string,
): Promise<ApiResponse<null>> {
  const adminUser = await requireAdmin()

  const supabase = createAdminClient()

  const { data: balance, error: fetchError } = await supabase
    .from('teacher_balances')
    .select('outstanding_debit_pkr')
    .eq('teacher_id', teacherId)
    .single()

  if (fetchError || !balance) {
    return { success: false, error: 'Teacher balance not found.' }
  }

  const currentDebit = (balance as { outstanding_debit_pkr: number }).outstanding_debit_pkr

  if (currentDebit <= 0) {
    return { success: false, error: 'No outstanding debit to clear.' }
  }

  const { error: updateError } = await supabase
    .from('teacher_balances')
    .update({
      outstanding_debit_pkr: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('teacher_id', teacherId)

  if (updateError) {
    return { success: false, error: 'Failed to clear debit. Please try again.' }
  }

  await logAdminActivity({
    teacherId,
    actionType: 'debit_cleared',
    performedBy: adminUser.email ?? adminUser.id,
    metadata: { clearedAmount: currentDebit },
  })

  revalidatePath('/admin/operations')
  revalidatePath('/admin/earnings')
  return { success: true, data: null }
}
