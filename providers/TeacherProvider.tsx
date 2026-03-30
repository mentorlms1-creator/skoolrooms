'use client'

/**
 * providers/TeacherProvider.tsx — Server → Client data bridge for teacher context
 *
 * Server Component (layout.tsx) fetches teacher data, plan details, and usage,
 * then wraps children in this provider. Client Components consume via useTeacherContext().
 *
 * This provider is thin — no fetching, just passes through server data.
 */

import { createContext, useContext } from 'react'
import type { PlanSlug } from '@/types/domain'

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

  return (
    <TeacherContext.Provider
      value={{ teacher, plan, usage, isLocked, isInGrace, isTrialing }}
    >
      {children}
    </TeacherContext.Provider>
  )
}
