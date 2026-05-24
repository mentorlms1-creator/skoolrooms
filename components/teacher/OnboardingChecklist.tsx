'use client'

/**
 * components/teacher/OnboardingChecklist.tsx — Onboarding progress banner
 *
 * Compact horizontal banner shown above the dashboard until all steps are
 * complete. Hides cleanly (returns null) once teacher.onboardingCompleted.
 */

import { Link } from 'next-view-transitions'
import { Check, ArrowRight } from 'lucide-react'
import { useTeacherContext } from '@/providers/TeacherProvider'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/lib/utils'

type OnboardingStep = {
  key: string
  label: string
  href: string
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  { key: 'profile_complete', label: 'Profile', href: ROUTES.TEACHER.settings.profile },
  { key: 'payment_details_set', label: 'Payouts', href: ROUTES.TEACHER.settings.payment },
  { key: 'course_created', label: 'First course', href: ROUTES.TEACHER.courseNew },
  { key: 'cohort_created', label: 'First cohort', href: ROUTES.TEACHER.courses },
  { key: 'link_shared', label: 'Share invite', href: ROUTES.TEACHER.courses },
]

export function OnboardingChecklist() {
  const { teacher } = useTeacherContext()

  if (teacher.onboardingCompleted) {
    return null
  }

  const steps = teacher.onboardingStepsJson
  const completedCount = ONBOARDING_STEPS.filter((s) => steps[s.key] === true).length
  const totalSteps = ONBOARDING_STEPS.length
  const progressPercent = (completedCount / totalSteps) * 100
  const nextStep = ONBOARDING_STEPS.find((s) => steps[s.key] !== true)

  return (
    <div className="mb-5 rounded-2xl bg-card ring-1 ring-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">
            Get started with Skool Rooms
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {completedCount} of {totalSteps} steps complete · {Math.round(progressPercent)}%
          </p>
        </div>
        {nextStep && (
          <Link
            href={nextStep.href}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            Continue setup
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-border/60">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <ul className="mt-4 flex flex-wrap gap-2">
        {ONBOARDING_STEPS.map((step) => {
          const isDone = steps[step.key] === true
          const isNext = step.key === nextStep?.key

          return (
            <li key={step.key}>
              <Link
                href={isDone ? '#' : step.href}
                aria-current={isNext ? 'step' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  isDone
                    ? 'bg-success/10 text-success cursor-default'
                    : isNext
                      ? 'bg-primary/10 text-primary ring-1 ring-primary/20 hover:bg-primary/15'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                )}
              >
                {isDone ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span
                    className={cn(
                      'h-3 w-3 rounded-full border',
                      isNext ? 'border-primary' : 'border-muted-foreground/40',
                    )}
                  />
                )}
                {step.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
