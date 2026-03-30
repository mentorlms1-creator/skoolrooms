// =============================================================================
// lib/email/sender.ts — Email sending via Brevo with preference checks + logging
// All emails go through this function. Never call Brevo directly elsewhere.
// Checks notification_preferences_json before sending (teacher recipients).
// Logs every call to notifications_log — even opt-out skips.
// =============================================================================

import { createAdminClient } from '@/supabase/server'
import type { EmailType } from '@/types/domain'

// -----------------------------------------------------------------------------
// Transactional emails that can NEVER be opted out of
// (financial/payment/plan emails — always sent regardless of preferences)
// -----------------------------------------------------------------------------
const TRANSACTIONAL_TYPES: ReadonlySet<string> = new Set([
  'payment_approved',
  'payment_rejected',
  'subscription_renewal_reminder',
  'grace_period_daily_reminder',
  'plan_hard_locked',
  'trial_ending_soon',
  'plan_downgraded',
  'payout_processed',
  'payout_failed',
  'refund_debit_recorded',
  'refund_debit_recovered',
  'enrollment_confirmed',
  'enrollment_rejected',
  'cohort_archived',
])

// -----------------------------------------------------------------------------
// sendEmail — Central email dispatcher
// -----------------------------------------------------------------------------

/**
 * Sends an email via Brevo and logs the result to notifications_log.
 *
 * Behavior:
 * 1. If recipientType is 'teacher', checks notification_preferences_json.
 *    If the teacher has opted out of this email type AND it's not transactional,
 *    the email is skipped but still logged with status 'skipped'.
 * 2. Sends via Brevo transactional email API.
 * 3. Logs to notifications_log with status 'sent', 'skipped', or 'failed'.
 * 4. Logs to email_delivery_log with Brevo's message ID for webhook correlation.
 */
export async function sendEmail(params: {
  to: string
  type: EmailType
  recipientId: string
  recipientType: 'teacher' | 'student'
  data: Record<string, unknown>
}): Promise<void> {
  const { to, type, recipientId, recipientType, data } = params
  const supabase = createAdminClient()

  // Step 1: Check notification preferences (teacher only)
  if (recipientType === 'teacher' && !TRANSACTIONAL_TYPES.has(type)) {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('notification_preferences_json')
      .eq('id', recipientId)
      .single()

    if (teacher?.notification_preferences_json) {
      const prefs = teacher.notification_preferences_json as Record<string, boolean>
      if (prefs[type] === false) {
        // Opted out — log as skipped and return
        await logNotification(supabase, {
          recipientType,
          recipientId,
          type,
          channel: 'email',
          status: 'skipped',
          metadata: data,
        })
        return
      }
    }
  }

  // Step 2: Send via Brevo
  const brevoApiKey = process.env.BREVO_API_KEY
  const fromEmail = process.env.BREVO_FROM_EMAIL || 'noreply@lumscribe.com'

  if (!brevoApiKey) {
    console.error('[sendEmail] BREVO_API_KEY not configured')
    await logNotification(supabase, {
      recipientType,
      recipientId,
      type,
      channel: 'email',
      status: 'failed',
      metadata: { ...data, error: 'BREVO_API_KEY not configured' },
    })
    return
  }

  // Build subject from email type and data
  const subject = buildSubject(type, data)
  const htmlContent = buildHtmlContent(type, data)

  let providerMessageId: string | null = null

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: 'Lumscribe' },
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Brevo API error ${response.status}: ${errorBody}`)
    }

    const result = (await response.json()) as { messageId?: string }
    providerMessageId = result.messageId ?? null

    // Step 3: Log successful send
    const notifId = await logNotification(supabase, {
      recipientType,
      recipientId,
      type,
      channel: 'email',
      status: 'sent',
      metadata: data,
    })

    // Step 4: Log to email_delivery_log for webhook correlation
    if (notifId) {
      await supabase.from('email_delivery_log').insert({
        notification_log_id: notifId,
        recipient_email: to,
        type,
        status: 'sent',
        provider_message_id: providerMessageId,
      })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[sendEmail] Failed to send ${type} to ${to}:`, errorMessage)

    await logNotification(supabase, {
      recipientType,
      recipientId,
      type,
      channel: 'email',
      status: 'failed',
      metadata: { ...data, error: errorMessage },
    })
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

type SupabaseAdmin = Awaited<ReturnType<typeof createAdminClient>>

async function logNotification(
  supabase: SupabaseAdmin,
  params: {
    recipientType: string
    recipientId: string
    type: string
    channel: string
    status: string
    metadata: Record<string, unknown>
  },
): Promise<string | null> {
  const { data, error } = await supabase
    .from('notifications_log')
    .insert({
      recipient_type: params.recipientType,
      recipient_id: params.recipientId,
      type: params.type,
      channel: params.channel,
      status: params.status,
      metadata: params.metadata,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[sendEmail] Failed to log notification:', error.message)
    return null
  }

  return data.id
}

/**
 * Builds a human-readable email subject line from the email type.
 * The `data` object may contain context-specific values for the subject.
 */
function buildSubject(type: EmailType, data: Record<string, unknown>): string {
  const platformName = (data.platformName as string) || 'Lumscribe'

  const subjects: Record<string, string> = {
    enrollment_confirmed: `${platformName} — Enrollment Confirmed`,
    enrollment_pending: `${platformName} — Enrollment Pending Verification`,
    enrollment_rejected: `${platformName} — Enrollment Update`,
    enrollment_refunded_cohort_full: `${platformName} — Cohort Full, Refund Issued`,
    waitlist_joined_after_payment_refund: `${platformName} — Added to Waitlist`,
    student_withdrawal_requested: `${platformName} — Withdrawal Request`,
    withdrawal_approved: `${platformName} — Withdrawal Approved`,
    withdrawal_rejected: `${platformName} — Withdrawal Update`,
    class_reminder_24h: `${platformName} — Class Tomorrow`,
    class_reminder_1h: `${platformName} — Class Starting Soon`,
    class_cancelled: `${platformName} — Class Cancelled`,
    payment_approved: `${platformName} — Payment Confirmed`,
    payment_rejected: `${platformName} — Payment Update`,
    subscription_renewal_reminder: `${platformName} — Subscription Renewal Reminder`,
    grace_period_daily_reminder: `${platformName} — Action Required: Plan Expiring`,
    plan_hard_locked: `${platformName} — Plan Locked`,
    trial_ending_soon: `${platformName} — Trial Ending Soon`,
    plan_downgraded: `${platformName} — Plan Updated`,
    payout_requested: `${platformName} — Payout Requested`,
    payout_processed: `${platformName} — Payout Processed`,
    payout_failed: `${platformName} — Payout Failed`,
    payout_pending_action: `${platformName} — New Payout Request`,
    new_subscription_screenshot: `${platformName} — New Subscription Screenshot`,
    gateway_error_alert: `${platformName} — Gateway Error Alert`,
    refund_debit_recorded: `${platformName} — Refund Debit Recorded`,
    refund_debit_recovered: `${platformName} — Refund Debit Recovered`,
    waitlist_joined: `${platformName} — Added to Waitlist`,
    waitlist_slots_available: `${platformName} — Slots Available`,
    fee_reminder: `${platformName} — Fee Reminder`,
    fee_overdue_5day: `${platformName} — Fee Overdue`,
    new_announcement: `${platformName} — New Announcement`,
    student_comment: `${platformName} — New Comment`,
    cohort_archived: `${platformName} — Cohort Archived`,
    enrollment_unverified_24h: `${platformName} — Enrollment Awaiting Verification`,
    subscription_screenshot_pending_48h: `${platformName} — Screenshot Pending Review`,
    new_enrollment_notification: `${platformName} — New Enrollment`,
    new_message: `${platformName} — New Message`,
    referral_converted: `${platformName} — Referral Reward`,
  }

  return subjects[type] || `${platformName} — Notification`
}

/**
 * Builds HTML email content from the email type and data.
 * In Phase 1 this generates simple HTML. Email templates can be
 * enhanced later without changing the sendEmail() interface.
 */
function buildHtmlContent(type: EmailType, data: Record<string, unknown>): string {
  const platformName = (data.platformName as string) || 'Lumscribe'
  const recipientName = (data.teacherName as string) || (data.studentName as string) || ''

  // Simple wrapper — replace with proper templates in future
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a1a;">${platformName}</h2>
      ${recipientName ? `<p>Hi ${recipientName},</p>` : ''}
      <p>This is a notification regarding: <strong>${type.replace(/_/g, ' ')}</strong></p>
      ${Object.entries(data)
        .filter(([key]) => !['platformName', 'teacherName', 'studentName', 'platformUrl'].includes(key))
        .map(([key, value]) => `<p><strong>${key}:</strong> ${String(value)}</p>`)
        .join('\n')}
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">
        Sent by ${platformName}${data.platformUrl ? ` — <a href="${String(data.platformUrl)}">${String(data.platformUrl)}</a>` : ''}
      </p>
    </body>
    </html>
  `
}
