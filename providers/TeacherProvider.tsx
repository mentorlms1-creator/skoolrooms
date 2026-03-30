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
import { USAGE_THRESHOLDS } from '@/constants/plans'

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

type TeacherContextType = {
  teacher: TeacherData
  plan: PlanDetails
  usage: UsageData
  isLocked: boolean
  isInGrace: boolean
  isTrialing: boolean
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
  children: React.ReactNode
}

export function TeacherProvider({
  teacher,
  plan,
  usage,
  children,
}: TeacherProviderProps) {
  const now = new Date()

  // Hard lock: paid plan expired AND grace period expired (or no grace)
  // Free plan never expires (planExpiresAt = null)
  const planExpired = teacher.planExpiresAt
    ? new Date(teacher.planExpiresAt) < now
    : false
  const graceExpired = teacher.graceUntil
    ? new Date(teacher.graceUntil) < now
    : true // no grace = grace is "expired" (not applicable)
  const isLocked = planExpired && graceExpired

  // In grace: plan expired but grace period still active
  const isInGrace = planExpired && !graceExpired

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
      value={{ teacher, plan, usage, isLocked, isInGrace, isTrialing, isNearLimit, isAtLimit }}
    >
      {children}
    </TeacherContext.Provider>
  )
}
