import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/supabase/server'
import { sendEmail } from '@/lib/email/sender'
import { revalidateTag } from '@/lib/cache/tags'
import { TIMING } from '@/constants/plans'

/**
 * GET /api/cron/grace-period — Daily cron job
 *
 * 5-step process:
 *   1. Set grace_until for newly expired paid plans (plan_expires_at < now,
 *      grace_until null) — call set_grace_period() RPC.
 *   2. Send daily reminder email to teachers in active grace period
 *      (grace_until > now, plan_expires_at < now).
 *   3. Soft-downgrade teachers whose grace just ended (grace_until < now,
 *      downgraded_at null) — call apply_soft_downgrade() RPC, send the
 *      one-time plan_soft_downgraded email, invalidate caches.
 *   4. Day-25 warning: teachers downgraded ≥ (30 - 5) days ago, no warning
 *      email sent yet → send plan_hard_cancel_warning.
 *   5. Hard-cancel notification: teachers downgraded ≥ 30 days, no cancel
 *      email sent yet → send plan_hard_cancelled.
 *
 * Each step is idempotent. Re-runs are safe.
 */
export async function GET(request: NextRequest) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const now = new Date()
    const nowIso = now.toISOString()
    let graceSet = 0
    let reminders = 0
    let downgraded = 0
    let warnings = 0
    let cancelled = 0

    // ── Step 1: Set grace period for newly expired plans ──
    const { data: newlyExpired } = await supabase
      .from('teachers')
      .select('id')
      .neq('plan', 'free')
      .lt('plan_expires_at', nowIso)
      .is('grace_until', null)
      .eq('is_suspended', false)

    if (newlyExpired && newlyExpired.length > 0) {
      for (const teacher of newlyExpired) {
        const { error: rpcError } = await supabase.rpc('set_grace_period', {
          p_teacher_id: teacher.id,
        })
        if (!rpcError) {
          graceSet++
        } else {
          console.error(
            `[cron:grace-period] Failed to set grace for teacher ${teacher.id}:`,
            rpcError.message,
          )
        }
      }
      console.log(`[cron:grace-period] Set grace period for ${graceSet} teachers`)
    }

    // ── Step 2: Send daily reminders to teachers in grace period ──
    const { data: inGrace } = await supabase
      .from('teachers')
      .select('id, name, email, grace_until, plan')
      .neq('plan', 'free')
      .lt('plan_expires_at', nowIso)
      .gt('grace_until', nowIso)
      .eq('is_suspended', false)

    if (inGrace && inGrace.length > 0) {
      for (const teacher of inGrace) {
        await sendEmail({
          to: teacher.email as string,
          type: 'grace_period_daily_reminder',
          recipientId: teacher.id as string,
          recipientType: 'teacher',
          data: {
            teacherName: teacher.name,
            graceUntil: teacher.grace_until,
            planName: teacher.plan,
          },
        })
        reminders++
      }
      console.log(`[cron:grace-period] Sent ${reminders} grace period reminders`)
    }

    // ── Step 3: Soft-downgrade teachers whose grace expired ──
    const { data: pendingDowngrade } = await supabase
      .from('teachers')
      .select('id, name, email, plan')
      .neq('plan', 'free')
      .lt('grace_until', nowIso)
      .is('downgraded_at', null)
      .eq('is_suspended', false)

    if (pendingDowngrade && pendingDowngrade.length > 0) {
      for (const teacher of pendingDowngrade) {
        const previousPlan = teacher.plan as string

        const { error: rpcError } = await supabase.rpc('apply_soft_downgrade', {
          p_teacher_id: teacher.id,
        })
        if (rpcError) {
          console.error(
            `[cron:grace-period] Failed to soft-downgrade ${teacher.id}:`,
            rpcError.message,
          )
          continue
        }

        // RPC won't no-op silently — re-check that downgrade actually applied
        // (race vs renewal: renewal may have raced ahead and reset state).
        const { data: postRow } = await supabase
          .from('teachers')
          .select('downgraded_at')
          .eq('id', teacher.id)
          .single()
        if (!postRow?.downgraded_at) continue

        // Bust caches: plan, public surfaces, explore-list.
        revalidateTag(`teacher-plan:${teacher.id}`)
        revalidateTag(`teacher:${teacher.id}`)
        revalidateTag(`teacher-courses:${teacher.id}`)
        revalidateTag('explore-list')

        await sendEmail({
          to: teacher.email as string,
          type: 'plan_soft_downgraded',
          recipientId: teacher.id as string,
          recipientType: 'teacher',
          data: {
            teacherName: teacher.name,
            previousPlan,
            daysUntilHardCancel: TIMING.SOFT_DOWNGRADE_TO_HARD_CANCEL_DAYS,
          },
        })
        downgraded++
      }
      if (downgraded > 0) {
        console.log(`[cron:grace-period] Soft-downgraded ${downgraded} teachers`)
      }
    }

    // ── Step 4: Day-25 warning email (5 days before hard cancel) ──
    const warningCutoffMs =
      now.getTime() -
      (TIMING.SOFT_DOWNGRADE_TO_HARD_CANCEL_DAYS -
        TIMING.HARD_CANCEL_WARNING_DAYS_BEFORE) *
        24 *
        60 *
        60 *
        1000
    const warningCutoffIso = new Date(warningCutoffMs).toISOString()
    const hardCancelCutoffMs =
      now.getTime() -
      TIMING.SOFT_DOWNGRADE_TO_HARD_CANCEL_DAYS * 24 * 60 * 60 * 1000
    const hardCancelCutoffIso = new Date(hardCancelCutoffMs).toISOString()

    const { data: pendingWarning } = await supabase
      .from('teachers')
      .select('id, name, email, downgraded_at')
      .lt('downgraded_at', warningCutoffIso)
      .gt('downgraded_at', hardCancelCutoffIso) // not yet at hard-cancel
      .eq('is_suspended', false)

    if (pendingWarning && pendingWarning.length > 0) {
      for (const teacher of pendingWarning) {
        // Idempotency: skip if warning already sent
        const { count } = await supabase
          .from('notifications_log')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', teacher.id as string)
          .eq('type', 'plan_hard_cancel_warning')
          .eq('status', 'sent')
        if ((count ?? 0) > 0) continue

        await sendEmail({
          to: teacher.email as string,
          type: 'plan_hard_cancel_warning',
          recipientId: teacher.id as string,
          recipientType: 'teacher',
          data: {
            teacherName: teacher.name,
            daysUntilHardCancel: TIMING.HARD_CANCEL_WARNING_DAYS_BEFORE,
          },
        })
        warnings++
      }
      if (warnings > 0) {
        console.log(`[cron:grace-period] Sent ${warnings} hard-cancel warnings`)
      }
    }

    // ── Step 5: Hard-cancel notification (day 30+) ──
    const { data: pendingCancel } = await supabase
      .from('teachers')
      .select('id, name, email, downgraded_at')
      .lt('downgraded_at', hardCancelCutoffIso)
      .eq('is_suspended', false)

    if (pendingCancel && pendingCancel.length > 0) {
      for (const teacher of pendingCancel) {
        const { count } = await supabase
          .from('notifications_log')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', teacher.id as string)
          .eq('type', 'plan_hard_cancelled')
          .eq('status', 'sent')
        if ((count ?? 0) > 0) continue

        // Bust caches one more time so any stale snapshot flips to hard-locked.
        revalidateTag(`teacher-plan:${teacher.id}`)
        revalidateTag(`teacher:${teacher.id}`)
        revalidateTag(`teacher-courses:${teacher.id}`)
        revalidateTag('explore-list')

        await sendEmail({
          to: teacher.email as string,
          type: 'plan_hard_cancelled',
          recipientId: teacher.id as string,
          recipientType: 'teacher',
          data: { teacherName: teacher.name },
        })
        cancelled++
      }
      if (cancelled > 0) {
        console.log(
          `[cron:grace-period] Sent ${cancelled} hard-cancel notifications`,
        )
      }
    }

    return NextResponse.json({
      success: true,
      graceSet,
      reminders,
      downgraded,
      warnings,
      cancelled,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[cron:grace-period] Unexpected error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
