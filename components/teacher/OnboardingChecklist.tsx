'use client'

/**
 * components/teacher/OnboardingChecklist.tsx — Onboarding progress checklist
 *
 * Shows 5 onboarding steps with completion status.
 * Hidden once all steps are complete (onboardingCompleted = true).
 */

import Link from 'next/link'
import { useTeacherContext } from '@/providers/TeacherProvider'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/constants/routes'

// -----------------------------------------------------------------------------
// Step definitions
// -----------------------------------------------------------------------------

type OnboardingStep = {
  key: string
  label: string
  description: string
  href: string
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: 'profile_complete',
    label: 'Complete your profile',
    description: 'Add your bio, subjects, and teaching levels so students can find you.',
    href: ROUTES.TEACHER.settings.profile,
  },
  {
    key: 'payment_details_set',
    label: 'Set up payout details',
    description: 'Add your bank account or mobile wallet to receive student payments.',
    href: ROUTES.TEACHER.settings.payment,
  },
  {
    key: 'course_created',
    label: 'Create your first course',
    description: 'Set up a course with a title, description, and fee.',
    href: ROUTES.TEACHER.courseNew,
  },
  {
    key: 'cohort_created',
    label: 'Create your first cohort',
    description: 'Add a cohort to your course with schedule and capacity.',
    href: ROUTES.TEACHER.courses,
  },
  {
    key: 'link_shared',
    label: 'Share your invite link',
    description: 'Send your enrollment link to students so they can join.',
    href: ROUTES.TEACHER.courses,
  },
]

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function OnboardingChecklist() {
  const { teacher } = useTeacherContext()

  // Hide if onboarding is fully complete
  if (teacher.onboardingCompleted) {
    return null
  }

  const steps = teacher.onboardingStepsJson
  const completedCount = ONBOARDING_STEPS.filter(
    (step) => steps[step.key] === true
  ).length
  const totalSteps = ONBOARDING_STEPS.length
  const progressPercent = (completedCount / totalSteps) * 100

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-ink">Get started with Lumscribe</h2>
        <p className="mt-1 text-sm text-muted">
          Complete these steps to set up your teaching platform.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium text-ink">
            {completedCount} of {totalSteps} completed
          </span>
          <span className="text-muted">{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-border">
          <div
            className="h-2 rounded-full bg-brand-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <ul className="flex flex-col gap-3">
        {ONBOARDING_STEPS.map((step) => {
          const isDone = steps[step.key] === true

          return (
            <li key={step.key}>
              <Link
                href={isDone ? '#' : step.href}
                className={`flex items-start gap-3 rounded-md p-3 transition-colors ${
                  isDone
                    ? 'cursor-default'
                    : 'hover:bg-paper'
                }`}
              >
                {/* Check circle */}
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-5 w-5 text-success"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 20 20"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-5 w-5 text-border"
                      aria-hidden="true"
                    >
                      <circle cx="10" cy="10" r="7.25" />
                    </svg>
                  )}
                </div>

                {/* Label and description */}
                <div>
                  <span
                    className={`text-sm font-medium ${
                      isDone ? 'text-muted line-through' : 'text-ink'
                    }`}
                  >
                    {step.label}
                  </span>
                  <p className="mt-0.5 text-xs text-muted">{step.description}</p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
