import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/supabase/server'
import { sendEmail } from '@/lib/email/sender'

/**
 * GET /api/cron/grace-period — Daily cron job
 *
 * 3-step process:
 * 1. Find teachers whose paid plan expired (plan_expires_at < now) AND grace_until IS NULL
 *    → call set_grace_period() RPC to set grace_until = plan_expires_at + 5 days
 * 2. Find teachers currently in grace period (grace_until > now AND plan_expires_at < now)
 *    → send daily grace_period_daily_reminder email
 * 3. Find teachers whose grace expired (grace_until < now AND plan_expires_at < now, plan != 'free')
 *    → send plan_hard_locked email (one-time, only if not already sent)
 */
export async function GET(request: NextRequest) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const now = new Date().toISOString()
    let graceSet = 0
    let reminders = 0
    let locked = 0

    // ── Step 1: Set grace period for newly expired plans ──
    const { data: newlyExpired } = await supabase
      .from('teachers')
      .select('id')
      .neq('plan', 'free')
      .lt('plan_expires_at', now)
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
            rpcError.message
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
      .lt('plan_expires_at', now)
      .gt('grace_until', now)
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

    // ── Step 3: Hard lock notification for expired grace periods ──
    // Teachers whose grace has expired — send one-time hard lock email
    // We identify these as: plan_expires_at < now AND grace_until < now AND plan != 'free'
    // To avoid re-sending, we check notifications_log for plan_hard_locked
    const { data: hardLocked } = await supabase
      .from('teachers')
      .select('id, name, email, plan')
      .neq('plan', 'free')
      .lt('plan_expires_at', now)
      .lt('grace_until', now)
      .eq('is_suspended', false)

    if (hardLocked && hardLocked.length > 0) {
      for (const teacher of hardLocked) {
        // Check if hard lock email already sent
        const { count } = await supabase
          .from('notifications_log')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', teacher.id as string)
          .eq('type', 'plan_hard_locked')
          .eq('status', 'sent')

        if ((count ?? 0) === 0) {
          await sendEmail({
            to: teacher.email as string,
            type: 'plan_hard_locked',
            recipientId: teacher.id as string,
            recipientType: 'teacher',
            data: {
              teacherName: teacher.name,
              planName: teacher.plan,
            },
          })
          locked++
        }
      }
      if (locked > 0) {
        console.log(`[cron:grace-period] Sent ${locked} hard lock notifications`)
      }
    }

    return NextResponse.json({
      success: true,
      graceSet,
      reminders,
      locked,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[cron:grace-period] Unexpected error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
