'use client'

/**
 * components/teacher/ExpiryBanner.tsx — Plan expiry warning banner
 *
 * 4 states from TeacherProvider:
 * 1. Expiry warning (amber): plan expires within 3 days
 * 2. Grace period (orange): in grace period
 * 3. Hard lock (red): grace expired, read-only mode
 * 4. Trial ending (amber): trial ends within 2 days
 *
 * Shows in teacher dashboard layout above content.
 */

import Link from 'next/link'
import { useTeacherContext } from '@/providers/TeacherProvider'
import { ROUTES } from '@/constants/routes'
import { TIMING } from '@/constants/plans'
import { formatPKT } from '@/lib/time/pkt'

type BannerState = 'expiry_warning' | 'grace_period' | 'hard_lock' | 'trial_ending' | null

function getBannerState(ctx: {
  teacher: {
    plan: string
    planExpiresAt: string | null
    graceUntil: string | null
    trialEndsAt: string | null
  }
  isLocked: boolean
  isInGrace: boolean
  isTrialing: boolean
}): BannerState {
  const { teacher, isLocked, isInGrace, isTrialing } = ctx
  const now = new Date()

  // Hard lock takes precedence
  if (isLocked) return 'hard_lock'

  // Grace period
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

const bannerStyles: Record<string, string> = {
  expiry_warning: 'bg-warning/10 border-warning/30 text-warning',
  grace_period: 'bg-warning/15 border-warning/40 text-warning',
  hard_lock: 'bg-danger/10 border-danger/30 text-danger',
  trial_ending: 'bg-warning/10 border-warning/30 text-warning',
}

export function ExpiryBanner() {
  const ctx = useTeacherContext()
  const state = getBannerState(ctx)

  if (!state) return null

  return (
    <div
      className={`mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 rounded-lg border px-4 py-3 text-sm ${bannerStyles[state]}`}
      role="alert"
    >
      <div className="flex-1">
        <BannerMessage state={state} teacher={ctx.teacher} />
      </div>
      {state !== 'hard_lock' ? (
        <Link
          href={ROUTES.PLATFORM.subscribe}
          className="w-full sm:w-auto text-center shrink-0 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
        >
          Renew Now
        </Link>
      ) : (
        <Link
          href={ROUTES.PLATFORM.subscribe}
          className="w-full sm:w-auto text-center shrink-0 rounded-full bg-danger px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-danger/90"
        >
          Renew to Unlock
        </Link>
      )}
    </div>
  )
}

function BannerMessage({
  state,
  teacher,
}: {
  state: BannerState
  teacher: {
    planExpiresAt: string | null
    graceUntil: string | null
    trialEndsAt: string | null
  }
}) {
  switch (state) {
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
          before your account is locked.
        </p>
      )
    }
    case 'hard_lock':
      return (
        <p>
          <strong>Account locked.</strong> Your plan and grace period have expired. You can view
          existing content but cannot create or edit courses, cohorts, or sessions until you renew.
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
