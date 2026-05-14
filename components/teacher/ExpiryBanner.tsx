'use client'

/**
 * components/teacher/ExpiryBanner.tsx — Plan expiry warning banner
 *
 * States (highest priority first):
 * 1. screenshot_rejected   — latest subscription rejected, teacher hasn't resubmitted
 * 2. screenshot_pending    — latest subscription awaiting admin verification
 * 3. hard_cancelled        — 30-day soft-downgrade window expired
 * 4. soft_downgraded       — grace passed; on Free, write-restricted
 * 5. grace_period          — plan expired, in 5-day grace
 * 6. expiry_warning        — plan expires within 3 days
 * 7. trial_ending          — trial ends within 2 days
 *
 * Pending/rejected take priority over the soft-downgrade messaging because they
 * represent active teacher work toward resolving the downgrade.
 */

import { Link } from 'next-view-transitions'
import { useTeacherContext } from '@/providers/TeacherProvider'
import type { LatestSubscription } from '@/providers/TeacherProvider'
import { ROUTES } from '@/constants/routes'
import { TIMING } from '@/constants/plans'
import { formatPKT } from '@/lib/time/pkt'

type BannerState =
  | 'screenshot_rejected'
  | 'screenshot_pending'
  | 'expiry_warning'
  | 'grace_period'
  | 'soft_downgraded'
  | 'hard_cancelled'
  | 'trial_ending'
  | null

function getBannerState(ctx: {
  teacher: {
    plan: string
    planExpiresAt: string | null
    graceUntil: string | null
    trialEndsAt: string | null
  }
  latestSubscription: LatestSubscription | null
  isLocked: boolean
  isInGrace: boolean
  isTrialing: boolean
  isSoftDowngraded: boolean
}): BannerState {
  const { teacher, latestSubscription, isLocked, isInGrace, isTrialing, isSoftDowngraded } = ctx
  const now = new Date()

  // Subscription-state overrides — only relevant when the teacher is actually
  // trying to upgrade off Free / restore their plan.
  if (latestSubscription) {
    if (latestSubscription.status === 'pending_verification') {
      return 'screenshot_pending'
    }
    // Show the rejection banner until the teacher submits a new attempt.
    // (Once they resubmit, the latest row will be the new pending one and
    // the pending branch above takes over.)
    if (latestSubscription.status === 'rejected') {
      return 'screenshot_rejected'
    }
  }

  // Hard cancel takes precedence over the remaining states.
  if (isLocked) return 'hard_cancelled'
  if (isSoftDowngraded) return 'soft_downgraded'
  if (isInGrace) return 'grace_period'

  // Plan expiry warning (within 3 days)
  if (teacher.planExpiresAt && teacher.plan !== 'free') {
    const expiresAt = new Date(teacher.planExpiresAt)
    const daysUntil = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    if (daysUntil > 0 && daysUntil <= TIMING.RENEWAL_REMINDER_DAYS_BEFORE) {
      return 'expiry_warning'
    }
  }

  // Trial ending (within 2 days)
  if (isTrialing && teacher.trialEndsAt) {
    const trialEnds = new Date(teacher.trialEndsAt)
    const daysUntil = (trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    if (daysUntil > 0 && daysUntil <= TIMING.TRIAL_ENDING_REMINDER_DAYS_BEFORE) {
      return 'trial_ending'
    }
  }

  return null
}

const bannerStyles: Record<NonNullable<BannerState>, string> = {
  screenshot_pending: 'bg-primary/5 border-primary/30 text-primary',
  screenshot_rejected: 'bg-destructive/10 border-destructive/30 text-destructive',
  expiry_warning: 'bg-warning/10 border-warning/30 text-warning',
  grace_period: 'bg-warning/15 border-warning/40 text-warning',
  soft_downgraded: 'bg-destructive/5 border-destructive/30 text-destructive',
  hard_cancelled: 'bg-destructive/10 border-destructive/30 text-destructive',
  trial_ending: 'bg-warning/10 border-warning/30 text-warning',
}

export function ExpiryBanner() {
  const ctx = useTeacherContext()
  const state = getBannerState(ctx)

  if (!state) return null

  const isPending = state === 'screenshot_pending'
  const isRejected = state === 'screenshot_rejected'
  const isDestructive =
    state === 'hard_cancelled' || state === 'soft_downgraded' || isRejected

  return (
    <div
      className={`mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 rounded-lg border px-4 py-3 text-sm ${bannerStyles[state]}`}
      role="alert"
    >
      <div className="flex-1">
        <BannerMessage
          state={state}
          teacher={ctx.teacher}
          latestSubscription={ctx.latestSubscription}
          daysUntilHardCancel={ctx.daysUntilHardCancel}
        />
      </div>
      {/* Pending review: no CTA — teacher already submitted, just waiting. */}
      {!isPending && (
        <Link
          href={ROUTES.PLATFORM.subscribe}
          className={`w-full sm:w-auto text-center shrink-0 rounded-full px-4 py-1.5 text-sm font-medium text-white transition-colors ${
            isDestructive
              ? 'bg-destructive hover:bg-destructive/90'
              : 'bg-primary hover:bg-primary/90'
          }`}
        >
          {state === 'hard_cancelled'
            ? 'Renew to Restore'
            : isRejected
            ? 'Re-submit Payment'
            : state === 'soft_downgraded'
            ? 'Renew Plan'
            : 'Renew Now'}
        </Link>
      )}
    </div>
  )
}

function BannerMessage({
  state,
  teacher,
  latestSubscription,
  daysUntilHardCancel,
}: {
  state: BannerState
  teacher: {
    planExpiresAt: string | null
    graceUntil: string | null
    trialEndsAt: string | null
  }
  latestSubscription: LatestSubscription | null
  daysUntilHardCancel: number | null
}) {
  switch (state) {
    case 'screenshot_pending': {
      const plan = latestSubscription?.plan
      return (
        <p>
          <strong>Your plan upgrade is being reviewed.</strong>{' '}
          {plan ? `We've received your ${plan} payment screenshot and ` : 'We’ve received your payment screenshot and '}
          our team will verify it shortly. You&apos;ll be notified by email and in-app the moment it&apos;s approved.
        </p>
      )
    }
    case 'screenshot_rejected': {
      const reason = latestSubscription?.rejectionReason?.trim() || 'No reason provided.'
      return (
        <div className="space-y-1">
          <p>
            <strong>Your payment was rejected.</strong>{' '}
            Please review the reason below and submit a new screenshot.
          </p>
          <p className="text-[13px] leading-snug opacity-90">
            <span className="font-semibold">Reason:</span> {reason}
          </p>
        </div>
      )
    }
    case 'expiry_warning': {
      const date = teacher.planExpiresAt ? formatPKT(teacher.planExpiresAt, 'date') : ''
      return (
        <p>
          <strong>Plan expiring soon.</strong> Your subscription expires on {date}. Renew now to
          avoid interruption.
        </p>
      )
    }
    case 'grace_period': {
      const date = teacher.graceUntil ? formatPKT(teacher.graceUntil, 'date') : ''
      return (
        <p>
          <strong>Grace period active.</strong> Your plan has expired. You have until {date} to renew
          before your account is downgraded.
        </p>
      )
    }
    case 'soft_downgraded': {
      const days = daysUntilHardCancel ?? 0
      return (
        <p>
          <strong>You&rsquo;re on the Free plan.</strong> Existing courses and students keep working,
          but you can&rsquo;t create new content, accept new students, or request payouts.{' '}
          <strong>{days} day{days === 1 ? '' : 's'}</strong> left before your account is cancelled
          and your students lose access.
        </p>
      )
    }
    case 'hard_cancelled':
      return (
        <p>
          <strong>Account cancelled.</strong> Your plan and the 30-day downgrade window have
          expired. Your students no longer have access to their courses. Renew to restore everything.
        </p>
      )
    case 'trial_ending': {
      const date = teacher.trialEndsAt ? formatPKT(teacher.trialEndsAt, 'date') : ''
      return (
        <p>
          <strong>Trial ending soon.</strong> Your trial ends on {date}. Subscribe now to keep your
          current plan features.
        </p>
      )
    }
    default:
      return null
  }
}
