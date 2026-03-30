import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/supabase/server'
import { sendEmail } from '@/lib/email/sender'
import { TIMING } from '@/constants/plans'

/**
 * GET /api/cron/renewal-reminders — Daily cron job
 *
 * Two checks:
 * 1. Subscription renewal: send reminder 3 days before plan_expires_at
 *    (for teachers with paid plans, not free, not suspended)
 * 2. Trial ending: send reminder 2 days before trial_ends_at
 *    (for teachers currently on trial)
 */
export async function GET(request: NextRequest) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    let renewalReminders = 0
    let trialReminders = 0

    // ── 1. Subscription renewal reminders (3 days before plan_expires_at) ──
    const now = new Date()
    const renewalWindowStart = new Date(now)
    renewalWindowStart.setDate(renewalWindowStart.getDate() + TIMING.RENEWAL_REMINDER_DAYS_BEFORE - 1)
    const renewalWindowEnd = new Date(now)
    renewalWindowEnd.setDate(renewalWindowEnd.getDate() + TIMING.RENEWAL_REMINDER_DAYS_BEFORE)

    // Find teachers whose plan expires within the reminder window
    // plan_expires_at is between now+2 days and now+3 days (i.e., 3 days from now)
    const { data: renewalTeachers } = await supabase
      .from('teachers')
      .select('id, name, email, plan, plan_expires_at')
      .neq('plan', 'free')
      .gt('plan_expires_at', renewalWindowStart.toISOString())
      .lte('plan_expires_at', renewalWindowEnd.toISOString())
      .is('trial_ends_at', null) // Not on trial (trial has separate reminder)
      .eq('is_suspended', false)

    if (renewalTeachers && renewalTeachers.length > 0) {
      for (const teacher of renewalTeachers) {
        await sendEmail({
          to: teacher.email as string,
          type: 'subscription_renewal_reminder',
          recipientId: teacher.id as string,
          recipientType: 'teacher',
          data: {
            teacherName: teacher.name,
            planName: teacher.plan,
            expiresAt: teacher.plan_expires_at,
          },
        })
        renewalReminders++
      }
      console.log(`[cron:renewal-reminders] Sent ${renewalReminders} renewal reminders`)
    }

    // ── 2. Trial ending reminders (2 days before trial_ends_at) ──
    const trialWindowStart = new Date(now)
    trialWindowStart.setDate(trialWindowStart.getDate() + TIMING.TRIAL_ENDING_REMINDER_DAYS_BEFORE - 1)
    const trialWindowEnd = new Date(now)
    trialWindowEnd.setDate(trialWindowEnd.getDate() + TIMING.TRIAL_ENDING_REMINDER_DAYS_BEFORE)

    const { data: trialTeachers } = await supabase
      .from('teachers')
      .select('id, name, email, plan, trial_ends_at')
      .neq('plan', 'free')
      .gt('trial_ends_at', trialWindowStart.toISOString())
      .lte('trial_ends_at', trialWindowEnd.toISOString())
      .eq('is_suspended', false)

    if (trialTeachers && trialTeachers.length > 0) {
      for (const teacher of trialTeachers) {
        await sendEmail({
          to: teacher.email as string,
          type: 'trial_ending_soon',
          recipientId: teacher.id as string,
          recipientType: 'teacher',
          data: {
            teacherName: teacher.name,
            planName: teacher.plan,
            trialEndsAt: teacher.trial_ends_at,
          },
        })
        trialReminders++
      }
      console.log(`[cron:renewal-reminders] Sent ${trialReminders} trial ending reminders`)
    }

    return NextResponse.json({
      success: true,
      renewalReminders,
      trialReminders,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[cron:renewal-reminders] Unexpected error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
