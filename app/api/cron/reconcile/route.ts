import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/supabase/server'
import { PaymentStatus, PaymentMethod } from '@/types/domain'

/**
 * GET /api/cron/reconcile — Daily cron job (02:00 UTC)
 *
 * Backfills `teacher_balances` from `student_payments`. Recovery net for the
 * rare case where a payment was confirmed but its `credit_teacher_balance`
 * call silently failed (e.g. the balance row didn't exist yet, or a transient
 * error swallowed the credit). Without this, the teacher's recorded earnings
 * drift below what they actually earned.
 *
 * Algorithm (per teacher):
 *   1. expected_earned = SUM(teacher_payout_amount_pkr) over all CONFIRMED,
 *      NON-MANUAL payments. Manual "Mark as Paid" payments never credit the
 *      balance (Business Rule 18), so they are excluded.
 *   2. Compare against the recorded total_earned_pkr.
 *   3. If expected > recorded → a credit was missed. Ensure a balance row
 *      exists, then credit exactly the shortfall via credit_teacher_balance.
 *
 * Safety:
 *   - Only ever credits UP. A surplus (recorded > expected) is logged and
 *     skipped — never debited. This keeps the job safe regardless of how
 *     refunds touch total_earned (refunded payments leave the confirmed set,
 *     so a refund can only make `recorded` look higher, never trigger a
 *     wrongful credit).
 *   - Idempotent: once backfilled, the next run computes a zero shortfall.
 *   - p_deduct_outstanding = false: backfill touches earnings only, never the
 *     refund-debit ledger. Outstanding debit is reconciled separately.
 */

const PAGE_SIZE = 1000

type PaymentRow = {
  teacher_payout_amount_pkr: number
  enrollments: { cohorts: { teacher_id: string } }
}

export async function GET(request: NextRequest) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    // ── Step 1: Sum expected earnings per teacher from confirmed payments ──
    // Paginate so we don't silently cap at Supabase's 1000-row default.
    const expectedByTeacher = new Map<string, number>()
    let offset = 0
    for (;;) {
      const { data, error } = await supabase
        .from('student_payments')
        .select(
          'teacher_payout_amount_pkr, enrollments!inner(cohorts!inner(teacher_id))',
        )
        .eq('status', PaymentStatus.CONFIRMED)
        .neq('payment_method', PaymentMethod.MANUAL)
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) {
        throw new Error(`Failed to read student_payments: ${error.message}`)
      }
      const rows = (data ?? []) as unknown as PaymentRow[]
      for (const row of rows) {
        const teacherId = row.enrollments?.cohorts?.teacher_id
        if (!teacherId) continue
        expectedByTeacher.set(
          teacherId,
          (expectedByTeacher.get(teacherId) ?? 0) + row.teacher_payout_amount_pkr,
        )
      }
      if (rows.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }

    let teachersChecked = 0
    let teachersCorrected = 0
    let totalBackfilledPkr = 0
    let surplusTeachers = 0

    // ── Step 2 & 3: Compare to recorded balance, backfill any shortfall ──
    for (const [teacherId, expectedEarned] of expectedByTeacher) {
      teachersChecked++

      const { data: balanceRow } = await supabase
        .from('teacher_balances')
        .select('total_earned_pkr')
        .eq('teacher_id', teacherId)
        .maybeSingle()

      const recordedEarned =
        (balanceRow as { total_earned_pkr: number } | null)?.total_earned_pkr ?? 0
      const shortfall = expectedEarned - recordedEarned

      if (shortfall === 0) continue
      if (shortfall < 0) {
        // Recorded exceeds confirmed earnings — expected after refunds. Never
        // debit from a reconcile pass; just flag it for manual review.
        surplusTeachers++
        console.warn(
          `[cron:reconcile] Teacher ${teacherId} has recorded earnings ` +
            `${recordedEarned} > confirmed ${expectedEarned} (surplus ` +
            `${-shortfall}). Skipping — manual review.`,
        )
        continue
      }

      // Ensure a balance row exists before crediting (credit RPC is an UPDATE
      // and no-ops silently against a missing row).
      if (!balanceRow) {
        await supabase
          .from('teacher_balances')
          .upsert({ teacher_id: teacherId }, { onConflict: 'teacher_id' })
      }

      const { error: creditError } = await supabase.rpc('credit_teacher_balance', {
        p_teacher_id: teacherId,
        p_amount: shortfall,
        p_deduct_outstanding: false,
      })

      if (creditError) {
        console.error(
          `[cron:reconcile] Failed to backfill teacher ${teacherId} ` +
            `(shortfall ${shortfall}):`,
          creditError.message,
        )
        continue
      }

      teachersCorrected++
      totalBackfilledPkr += shortfall
      console.log(
        `[cron:reconcile] Backfilled teacher ${teacherId}: +${shortfall} PKR ` +
          `(recorded ${recordedEarned} → expected ${expectedEarned})`,
      )
    }

    if (teachersCorrected > 0) {
      console.log(
        `[cron:reconcile] Corrected ${teachersCorrected} teacher(s), ` +
          `backfilled ${totalBackfilledPkr} PKR total`,
      )
    }

    return NextResponse.json({
      success: true,
      teachersChecked,
      teachersCorrected,
      totalBackfilledPkr,
      surplusTeachers,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[cron:reconcile] Unexpected error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
