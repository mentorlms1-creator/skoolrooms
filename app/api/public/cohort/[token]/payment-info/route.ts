// =============================================================================
// app/api/public/cohort/[token]/payment-info/route.ts
// PUBLIC GET endpoint — returns cohort fee info + teacher payment details
// for the student payment page. No auth required.
// =============================================================================

import { NextResponse } from 'next/server'
import { getCohortByInviteToken } from '@/lib/db/cohorts'
import { createAdminClient } from '@/supabase/server'
import type { ApiResponse } from '@/types/api'

// -----------------------------------------------------------------------------
// Response shape
// -----------------------------------------------------------------------------
type PaymentInfoData = {
  feePkr: number
  feeType: string
  billingDay: number | null
  bankName: string | null
  accountTitle: string | null
  iban: string | null
  jazzcashNumber: string | null
  easypaisaNumber: string | null
  qrCodeUrl: string | null
  instructions: string | null
  cohortName: string
  courseName: string
  teacherName: string
}

// -----------------------------------------------------------------------------
// GET /api/public/cohort/[token]/payment-info
// -----------------------------------------------------------------------------
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse<ApiResponse<PaymentInfoData>>> {
  const { token } = await params

  // 1. Fetch cohort by invite token (joins course)
  const cohort = await getCohortByInviteToken(token)

  if (!cohort) {
    return NextResponse.json(
      { success: false, error: 'Cohort not found' },
      { status: 404 },
    )
  }

  // 2. Fetch teacher name
  const supabase = createAdminClient()

  const { data: teacher, error: teacherError } = await supabase
    .from('teachers')
    .select('name')
    .eq('id', cohort.teacher_id)
    .single()

  if (teacherError || !teacher) {
    return NextResponse.json(
      { success: false, error: 'Teacher not found' },
      { status: 404 },
    )
  }

  // 3. Fetch teacher payment settings
  const { data: paymentSettings } = await supabase
    .from('teacher_payment_settings')
    .select('payout_bank_name, payout_account_title, payout_iban, jazzcash_number, easypaisa_number, qr_code_url, instructions')
    .eq('teacher_id', cohort.teacher_id)
    .single()

  // 4. Return payment info
  return NextResponse.json({
    success: true,
    data: {
      feePkr: cohort.fee_pkr,
      feeType: cohort.fee_type,
      billingDay: cohort.billing_day,
      bankName: (paymentSettings?.payout_bank_name as string | null) ?? null,
      accountTitle: (paymentSettings?.payout_account_title as string | null) ?? null,
      iban: (paymentSettings?.payout_iban as string | null) ?? null,
      jazzcashNumber: (paymentSettings?.jazzcash_number as string | null) ?? null,
      easypaisaNumber: (paymentSettings?.easypaisa_number as string | null) ?? null,
      qrCodeUrl: (paymentSettings?.qr_code_url as string | null) ?? null,
      instructions: (paymentSettings?.instructions as string | null) ?? null,
      cohortName: cohort.name,
      courseName: cohort.courses.title,
      teacherName: teacher.name as string,
    },
  })
}
