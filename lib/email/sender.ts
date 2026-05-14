// =============================================================================
// lib/email/sender.ts — Email sending via Brevo with preference checks + logging
// All emails go through this function. Never call Brevo directly elsewhere.
// Checks notification_preferences_json before sending (teacher recipients).
// Logs every call to notifications_log — even opt-out skips.
// =============================================================================

import { createAdminClient } from '@/supabase/server'
import { platformDomain, platformUrl, studentPortalUrl } from '@/lib/platform/domain'
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
  'plan_soft_downgraded',
  'plan_hard_cancel_warning',
  'plan_hard_cancelled',
  'payout_processed',
  'payout_failed',
  'refund_debit_recorded',
  'refund_debit_recovered',
  'enrollment_confirmed',
  'enrollment_rejected',
  'enrollment_revoked',
  'cohort_archived',
  'signup_confirmation',
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
  const fromEmail = process.env.BREVO_FROM_EMAIL || `noreply@${platformDomain()}`

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
        sender: { email: fromEmail, name: 'Skool Rooms' },
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
  const platformName = (data.platformName as string) || 'Skool Rooms'

  const subjects: Record<string, string> = {
    enrollment_confirmed: `${platformName} — Enrollment Confirmed`,
    enrollment_pending: `${platformName} — Enrollment Pending Verification`,
    enrollment_rejected: `${platformName} — Enrollment Update`,
    enrollment_revoked: `${platformName} — Enrollment Revoked`,
    enrollment_refunded_cohort_full: `${platformName} — Cohort Full, Refund Issued`,
    waitlist_joined_after_payment_refund: `${platformName} — Added to Waitlist`,
    student_withdrawal_requested: `${platformName} — Withdrawal Request`,
    withdrawal_approved: `${platformName} — Withdrawal Approved`,
    withdrawal_rejected: `${platformName} — Withdrawal Update`,
    class_reminder_24h: `${platformName} — Class Tomorrow`,
    class_reminder_1h: `${platformName} — Class Starting Soon`,
    class_cancelled: `${platformName} — Class Cancelled`,
    class_rescheduled: `${platformName} — Class Rescheduled`,
    payment_approved: `${platformName} — Payment Confirmed`,
    payment_rejected: `${platformName} — Payment Update`,
    subscription_renewal_reminder: `${platformName} — Subscription Renewal Reminder`,
    grace_period_daily_reminder: `${platformName} — Action Required: Plan Expiring`,
    plan_hard_locked: `${platformName} — Plan Locked`,
    trial_ending_soon: `${platformName} — Trial Ending Soon`,
    plan_downgraded: `${platformName} — Plan Updated`,
    plan_soft_downgraded: `${platformName} — You're on Free — Renew to keep your full plan`,
    plan_hard_cancel_warning: `${platformName} — Final warning: 5 days until your account is cancelled`,
    plan_hard_cancelled: `${platformName} — Your account has been cancelled`,
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
    admin_broadcast: (data.subject as string) || `${platformName} — Important Update`,
    subdomain_changed: `${platformName} — Your subdomain has changed`,
    certificate_issued: `${platformName} — Your certificate for ${(data.cohortName as string) || 'your cohort'} is ready`,
    signup_confirmation: `Confirm your email — ${platformName}`,
  }

  return subjects[type] || `${platformName} — Notification`
}

/**
 * Builds HTML email content from the email type and data.
 * In Phase 1 this generates simple HTML. Email templates can be
 * enhanced later without changing the sendEmail() interface.
 */
function buildHtmlContent(type: EmailType, data: Record<string, unknown>): string {
  const platformName = (data.platformName as string) || 'Skool Rooms'
  const recipientName = (data.teacherName as string) || (data.studentName as string) || ''

  if (type === 'signup_confirmation') {
    const confirmationUrl = data.confirmationUrl as string
    const teacherName = (data.teacherName as string) || ''
    const logoUrl = platformUrl('/logo.png')
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
      <body style="margin:0; padding:0; background-color:#f5f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color:#1a1a1a;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f4f8; padding:40px 16px;">
          <tr><td align="center">
            <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(70,40,180,0.06);">
              <tr><td style="padding:32px 40px 24px; text-align:left; border-bottom:1px solid #f0eef5;">
                <img src="${logoUrl}" alt="${platformName}" width="140" style="display:block; max-width:140px; height:auto;" />
              </td></tr>
              <tr><td style="padding:40px 40px 32px;">
                <h1 style="margin:0 0 16px; font-size:24px; line-height:1.3; font-weight:700; color:#1a1a1a; letter-spacing:-0.01em;">Confirm your email${teacherName ? `, ${teacherName}` : ''}</h1>
                <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#4a4a55;">Welcome to ${platformName}. Tap the button below to confirm your email address and start setting up your teaching dashboard.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 32px;"><tr>
                  <td style="background:#6d28d9; border-radius:10px;">
                    <a href="${confirmationUrl}" style="display:inline-block; padding:14px 28px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:10px;">Confirm email →</a>
                  </td>
                </tr></table>
                <p style="margin:0 0 8px; font-size:13px; line-height:1.5; color:#7a7a85;">Or copy and paste this link in your browser:</p>
                <p style="margin:0 0 24px; font-size:13px; line-height:1.5; word-break:break-all;">
                  <a href="${confirmationUrl}" style="color:#6d28d9; text-decoration:underline;">${confirmationUrl}</a>
                </p>
                <div style="height:1px; background:#f0eef5; margin:24px 0;"></div>
                <p style="margin:0; font-size:13px; line-height:1.5; color:#7a7a85;">Didn't sign up? You can safely ignore this email — no account will be created.</p>
              </td></tr>
              <tr><td style="padding:24px 40px 32px; background:#fafafd; border-top:1px solid #f0eef5;">
                <p style="margin:0; font-size:12px; line-height:1.5; color:#9a9aa5; text-align:center;">
                  ${platformName} · Built for independent tutors and coaching centers<br />
                  <a href="${platformUrl()}" style="color:#9a9aa5; text-decoration:none;">${platformDomain()}</a>
                </p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `
  }

  if (type === 'subdomain_changed') {
    const oldUrl = data.oldUrl as string
    const newUrl = data.newUrl as string
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a;">${platformName}</h2>
        ${recipientName ? `<p>Hi ${recipientName},</p>` : ''}
        <p>Your teaching page URL has been changed.</p>
        <p>
          <strong>Old URL (no longer active):</strong><br>
          <span style="color: #888; text-decoration: line-through;">${oldUrl}</span>
        </p>
        <p>
          <strong>New URL:</strong><br>
          <a href="${newUrl}" style="color: #4f46e5; font-weight: 600;">${newUrl}</a>
        </p>
        <p style="color: #555;">
          Share your new link with your students. The old link no longer works.
          You can change your subdomain again after 30 days.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          If you did not make this change, please contact support immediately.
        </p>
      </body>
      </html>
    `
  }

  if (type === 'class_rescheduled') {
    const cohortName = (data.cohortName as string) || 'your class'
    const oldTime = (data.oldTimePKT as string) || ''
    const newTime = (data.newTimePKT as string) || ''
    const meetLink = (data.meetLink as string) || ''
    const teacherName = (data.teacherName as string) || ''
    const reason = (data.reason as string) || ''
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a;">${platformName}</h2>
        ${recipientName ? `<p>Hi ${recipientName},</p>` : ''}
        <p>A session for <strong>${cohortName}</strong>${teacherName ? ` with ${teacherName}` : ''} has been rescheduled.</p>
        ${oldTime ? `<p><strong>Original time:</strong> <span style="text-decoration: line-through; color: #888;">${oldTime}</span></p>` : ''}
        ${newTime ? `<p><strong>New time:</strong> ${newTime}</p>` : ''}
        ${meetLink ? `<p><strong>Join link:</strong> <a href="${meetLink}" style="color: #4f46e5;">${meetLink}</a></p>` : ''}
        ${reason ? `<p style="color: #555;"><em>${reason}</em></p>` : ''}
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Sent by ${platformName}</p>
      </body>
      </html>
    `
  }

  if (type === 'certificate_issued') {
    const studentName = (data.studentName as string) || ''
    const teacherName = (data.teacherName as string) || ''
    const courseName = (data.courseName as string) || ''
    const cohortName = (data.cohortName as string) || ''
    const certificateNumber = (data.certificateNumber as string) || ''
    const downloadUrl = studentPortalUrl('/student/payments')
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a;">${platformName}</h2>
        ${studentName ? `<p>Hi ${studentName},</p>` : ''}
        <p>${teacherName ? `Your teacher <strong>${teacherName}</strong> has issued` : 'You have been issued'} your certificate of completion${courseName ? ` for <strong>${courseName}</strong>` : ''}${cohortName ? ` (${cohortName})` : ''}.</p>
        <p style="margin: 24px 0;">
          <a href="${downloadUrl}" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Download certificate</a>
        </p>
        <p style="color: #666; font-size: 13px;">Open your dashboard, find this cohort, and click <em>Download certificate</em>. You'll need to be logged in to your student account.</p>
        ${certificateNumber ? `<p style="color: #666; font-size: 12px;">Certificate number: <strong>${certificateNumber}</strong></p>` : ''}
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Sent by ${platformName}</p>
      </body>
      </html>
    `
  }

  if (type === 'plan_soft_downgraded') {
    const teacherName = (data.teacherName as string) || ''
    const previousPlan = (data.previousPlan as string) || 'paid'
    const days = (data.daysUntilHardCancel as number) || 30
    const renewUrl = platformUrl('/subscribe')
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a;">${platformName}</h2>
        ${teacherName ? `<p>Hi ${teacherName},</p>` : ''}
        <p>Your <strong>${previousPlan}</strong> plan has expired and the grace period has ended.</p>
        <p>You're now on the <strong>Free</strong> plan. Your existing courses, cohorts, and students stay accessible — but until you renew you can't:</p>
        <ul style="color: #555;">
          <li>Create new courses, cohorts, sessions, announcements, or assignments</li>
          <li>Accept new student enrollments</li>
          <li>Approve new student payments</li>
          <li>Request payouts (your balance is frozen)</li>
        </ul>
        <p style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0;">
          <strong>You have ${days} days to renew.</strong> After that, your account is cancelled and your students lose access to their courses.
        </p>
        <p style="margin: 24px 0;">
          <a href="${renewUrl}" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Renew now</a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Sent by ${platformName}</p>
      </body>
      </html>
    `
  }

  if (type === 'plan_hard_cancel_warning') {
    const teacherName = (data.teacherName as string) || ''
    const days = (data.daysUntilHardCancel as number) || 5
    const renewUrl = platformUrl('/subscribe')
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a;">${platformName}</h2>
        ${teacherName ? `<p>Hi ${teacherName},</p>` : ''}
        <p style="font-size: 18px; color: #b91c1c;"><strong>Final warning.</strong></p>
        <p>In <strong>${days} days</strong> your account will be cancelled and your students will lose access to their courses, cohort materials, and live sessions.</p>
        <p>This is your last chance to renew without disruption.</p>
        <p style="margin: 24px 0;">
          <a href="${renewUrl}" style="display: inline-block; background: #b91c1c; color: #ffffff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Renew before cancellation</a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Sent by ${platformName}</p>
      </body>
      </html>
    `
  }

  if (type === 'plan_hard_cancelled') {
    const teacherName = (data.teacherName as string) || ''
    const renewUrl = platformUrl('/subscribe')
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a;">${platformName}</h2>
        ${teacherName ? `<p>Hi ${teacherName},</p>` : ''}
        <p>Your account has been <strong>cancelled</strong>. Your subdomain is offline and your students no longer have access to their courses.</p>
        <p>Your data is preserved — renewing your subscription will restore everything (courses, cohorts, students, sessions) exactly as it was.</p>
        <p style="margin: 24px 0;">
          <a href="${renewUrl}" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Renew and restore access</a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Sent by ${platformName}</p>
      </body>
      </html>
    `
  }

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
