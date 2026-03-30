import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/supabase/server'
import { sendEmail } from '@/lib/email/sender'

/**
 * GET /api/cron/trial-expiry — Daily cron job
 *
 * Find teachers where trial_ends_at < now AND plan != 'free'
 * → downgrade to free plan immediately (trial has NO grace period)
 * → send plan_downgraded email
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
    let downgraded = 0

    // Find teachers with expired trials who haven't been downgraded yet
    const { data: expiredTrials, error: fetchError } = await supabase
      .from('teachers')
      .select('id, name, email, plan, trial_ends_at')
      .neq('plan', 'free')
      .lt('trial_ends_at', now)
      .eq('is_suspended', false)

    if (fetchError) {
      console.error('[cron:trial-expiry] Failed to fetch expired trials:', fetchError.message)
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }

    if (!expiredTrials || expiredTrials.length === 0) {
      return NextResponse.json({ success: true, downgraded: 0 })
    }

    for (const teacher of expiredTrials) {
      // Only downgrade if teacher doesn't have a valid plan_expires_at
      // (they might have subscribed during trial, in which case plan_expires_at
      // would be set and trial_ends_at is cleared by approveSubscriptionAction)
      // But if trial_ends_at is still set and < now, and plan != free,
      // they haven't subscribed — downgrade them.

      const { error: updateError } = await supabase
        .from('teachers')
        .update({
          plan: 'free',
          trial_ends_at: null,
          plan_expires_at: null,
          grace_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', teacher.id as string)

      if (updateError) {
        console.error(
          `[cron:trial-expiry] Failed to downgrade teacher ${teacher.id}:`,
          updateError.message
        )
        continue
      }

      // Send downgrade notification
      await sendEmail({
        to: teacher.email as string,
        type: 'plan_downgraded',
        recipientId: teacher.id as string,
        recipientType: 'teacher',
        data: {
          teacherName: teacher.name,
          previousPlan: teacher.plan,
          newPlan: 'free',
          reason: 'Trial period ended',
        },
      })

      downgraded++
    }

    console.log(`[cron:trial-expiry] Downgraded ${downgraded} expired trials`)
    return NextResponse.json({ success: true, downgraded })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[cron:trial-expiry] Unexpected error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
