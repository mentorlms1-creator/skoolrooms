'use client'

/**
 * providers/TeacherProvider.tsx — Server → Client data bridge for teacher context
 *
 * Server Component (layout.tsx) fetches teacher data, plan details, and usage,
 * then wraps children in this provider. Client Components consume via useTeacherContext().
 *
 * This provider is thin — no fetching, just passes through server data.
 */

import { createContext, useContext, useCallback } from 'react'
import type { PlanSlug } from '@/types/domain'
import { TIMING, USAGE_THRESHOLDS } from '@/constants/plans'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type TeacherData = {
  id: string
  name: string
  email: string
  subdomain: string
  plan: PlanSlug
  planExpiresAt: string | null
  graceUntil: string | null
  /** When the soft-downgrade landed. Anchors the 30-day clock to hard-cancel. */
  downgradedAt: string | null
  trialEndsAt: string | null
  onboardingCompleted: boolean
  onboardingStepsJson: Record<string, boolean>
  isSuspended: boolean
  profilePhotoUrl: string | null
  bio: string | null
  subjectTags: string[]
  teachingLevels: string[]
  city: string | null
  isPubliclyListed: boolean
}

export type PlanDetails = {
  name: string
  slug: PlanSlug
  pricePerMonth: number
  limits: Record<string, number | null>
  features: Record<string, boolean>
}

export type UsageData = {
  courses: number
  students: number
  cohortsActive: number
  storageMb: number
}

/** Subset of the latest teacher_subscriptions row, surfaced to client components. */
export type LatestSubscription = {
  id: string
  plan: string
  status: string
  rejectionReason: string | null
  createdAt: string
}

type TeacherContextType = {
  teacher: TeacherData
  plan: PlanDetails
  usage: UsageData
  /** Most recent teacher_subscriptions row (any status). null if none ever submitted. */
  latestSubscription: LatestSubscription | null
  /** Day-30+ hard cancel: read-only for teacher, students lose access. */
  isLocked: boolean
  isInGrace: boolean
  isTrialing: boolean
  /** Day 5–30: plan flipped to Free, usage grandfathered, write surface restricted. */
  isSoftDowngraded: boolean
  /** Whole-day count remaining before hard cancel; null when not soft-downgraded. */
  daysUntilHardCancel: number | null
  isNearLimit: (key: string) => boolean
  isAtLimit: (key: string) => boolean
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const TeacherContext = createContext<TeacherContextType | null>(null)

export function useTeacherContext() {
  const ctx = useContext(TeacherContext)
  if (!ctx) {
    throw new Error('useTeacherContext must be used within TeacherProvider')
  }
  return ctx
}

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

type TeacherProviderProps = {
  teacher: TeacherData
  plan: PlanDetails
  usage: UsageData
  latestSubscription: LatestSubscription | null
  children: React.ReactNode
}

export function TeacherProvider({
  teacher,
  plan,
  usage,
  latestSubscription,
  children,
}: TeacherProviderProps) {
  const now = new Date()
  const MS_PER_DAY = 24 * 60 * 60 * 1000

  // Soft-downgrade window starts when downgraded_at is set, OR (cron-lag
  // safety) the moment grace_until passes — whichever happens first.
  const downgradeAnchorIso =
    teacher.downgradedAt ??
    (teacher.graceUntil && new Date(teacher.graceUntil) < now && teacher.plan !== 'free'
      ? teacher.graceUntil
      : null)

  let isSoftDowngraded = false
  let isLocked = false
  let daysUntilHardCancel: number | null = null

  if (downgradeAnchorIso) {
    const anchorMs = new Date(downgradeAnchorIso).getTime()
    const hardCancelMs =
      anchorMs + TIMING.SOFT_DOWNGRADE_TO_HARD_CANCEL_DAYS * MS_PER_DAY
    if (now.getTime() >= hardCancelMs) {
      isLocked = true
    } else {
      isSoftDowngraded = true
      daysUntilHardCancel = Math.max(
        0,
        Math.ceil((hardCancelMs - now.getTime()) / MS_PER_DAY),
      )
    }
  }

  // In grace: plan expired but grace period still active. Grace is mutually
  // exclusive with soft-downgrade (downgrade kicks in once grace passes).
  const planExpired = teacher.planExpiresAt
    ? new Date(teacher.planExpiresAt) < now
    : false
  const graceActive =
    !!teacher.graceUntil && new Date(teacher.graceUntil) >= now
  const isInGrace = !isSoftDowngraded && !isLocked && planExpired && graceActive

  // Trialing: trial end date set and hasn't passed yet
  const isTrialing = teacher.trialEndsAt
    ? new Date(teacher.trialEndsAt) > now
    : false

  const usageMap: Record<string, number> = {
    max_courses: usage.courses,
    max_students: usage.students,
    max_cohorts_active: usage.cohortsActive,
    max_storage_mb: usage.storageMb,
  }

  const isNearLimit = useCallback(
    (key: string) => {
      const limit = plan.limits[key]
      if (limit === null || limit === undefined) return false
      const current = usageMap[key] ?? 0
      return current / limit >= USAGE_THRESHOLDS.WARNING_PERCENT / 100
    },
    [plan.limits, usage]
  )

  const isAtLimit = useCallback(
    (key: string) => {
      const limit = plan.limits[key]
      if (limit === null || limit === undefined) return false
      const current = usageMap[key] ?? 0
      return current >= limit
    },
    [plan.limits, usage]
  )

  return (
    <TeacherContext.Provider
      value={{
        teacher,
        plan,
        usage,
        latestSubscription,
        isLocked,
        isInGrace,
        isTrialing,
        isSoftDowngraded,
        daysUntilHardCancel,
        isNearLimit,
        isAtLimit,
      }}
    >
      {children}
    </TeacherContext.Provider>
  )
}
