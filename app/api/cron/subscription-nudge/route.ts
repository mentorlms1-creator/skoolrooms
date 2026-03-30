import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/supabase/server'
import { sendEmail } from '@/lib/email/sender'

/**
 * GET /api/cron/subscription-nudge
 *
 * Daily cron. Finds teacher_subscriptions with status='pending_verification'
 * created more than 48h ago. Sends a nudge email to admin reminding them
 * to review the subscription screenshot.
 */
export async function GET(request: NextRequest) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    // Subscriptions pending verification for more than 48 hours
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    const { data: subscriptions, error: subError } = await supabase
      .from('teacher_subscriptions')
      .select(`
        id, plan, amount_pkr, created_at,
        teachers!inner(id, name, email)
      `)
      .eq('status', 'pending_verification')
      .lt('created_at', cutoff)

    if (subError) {
      console.error('[cron:subscription-nudge] Failed to fetch subscriptions:', subError.message)
      return NextResponse.json({ success: false, error: subError.message }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0, reason: 'No pending subscriptions older than 48h' })
    }

    console.log(`[cron:subscription-nudge] Found ${subscriptions.length} pending subscriptions`)

    // Get admin email from platform settings
    const { data: adminSetting } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'admin_email')
      .single()

    const adminEmail = (adminSetting?.value as string | undefined) ?? process.env.ADMIN_EMAIL ?? ''

    if (!adminEmail) {
      console.error('[cron:subscription-nudge] No admin email configured')
      return NextResponse.json({ success: false, error: 'No admin email configured' }, { status: 500 })
    }

    // Build summary of pending subscriptions
    const subscriptionSummary = subscriptions.map((sub) => {
      const teacher = sub.teachers as unknown as { id: string; name: string; email: string }
      return `${teacher.name} (${teacher.email}) — ${sub.plan} plan — Rs. ${(sub.amount_pkr as number).toLocaleString('en-PK')}`
    }).join('; ')

    // Send one consolidated email to admin
    await sendEmail({
      to: adminEmail,
      type: 'subscription_screenshot_pending_48h',
      recipientId: 'admin',
      recipientType: 'teacher', // Admin uses teacher type for notification system
      data: {
        pendingCount: subscriptions.length,
        subscriptionSummary,
      },
    })

    console.log(`[cron:subscription-nudge] Done. Sent nudge email to admin for ${subscriptions.length} subscriptions`)
    return NextResponse.json({ success: true, sent: 1, pendingCount: subscriptions.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[cron:subscription-nudge] Unexpected error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
