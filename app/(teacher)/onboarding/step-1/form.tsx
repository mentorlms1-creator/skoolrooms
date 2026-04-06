'use client'

// =============================================================================
// app/(teacher)/onboarding/step-1/form.tsx — Subject & level chip selector
// =============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { saveOnboardingStep1 } from '@/lib/actions/onboarding'
import { ROUTES } from '@/constants/routes'

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'Urdu',
  'Computer Science',
  'Islamiat',
  'Pakistan Studies',
  'Economics',
  'Business Studies',
  'Accounting',
  'Art & Design',
  'Music',
  'Other',
] as const

const LEVELS = [
  'Primary 1-5',
  'Middle 6-8',
  'Matric 9-10',
  'Intermediate 11-12',
  'O-Level',
  'A-Level',
  'University',
  'Test Prep',
  'Professional',
] as const

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

type Step1FormProps = {
  defaultSubjects: string[]
  defaultLevels: string[]
}

export function Step1Form({ defaultSubjects, defaultLevels }: Step1FormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(
    new Set(defaultSubjects),
  )
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(
    new Set(defaultLevels),
  )
  const [error, setError] = useState<string | null>(null)

  function toggleSubject(subject: string) {
    setSelectedSubjects((prev) => {
      const next = new Set(prev)
      if (next.has(subject)) {
        next.delete(subject)
      } else {
        next.add(subject)
      }
      return next
    })
  }

  function toggleLevel(level: string) {
    setSelectedLevels((prev) => {
      const next = new Set(prev)
      if (next.has(level)) {
        next.delete(level)
      } else {
        next.add(level)
      }
      return next
    })
  }

  function handleSubmit() {
    setError(null)

    if (selectedSubjects.size === 0) {
      setError('Please select at least one subject.')
      return
    }

    if (selectedLevels.size === 0) {
      setError('Please select at least one teaching level.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      selectedSubjects.forEach((s) => formData.append('subject_tags', s))
      selectedLevels.forEach((l) => formData.append('teaching_levels', l))

      const result = await saveOnboardingStep1(formData)

      if (!result.success) {
        setError(result.error)
        return
      }

      router.push(ROUTES.PLATFORM.onboarding.step2)
    })
  }

  return (
    <div className="space-y-6">
      {/* Subjects */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">Subjects</h3>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((subject) => {
            const isSelected = selectedSubjects.has(subject)
            return (
              <button
                key={subject}
                type="button"
                onClick={() => toggleSubject(subject)}
                className={`
                  rounded-full border px-3 py-1.5 text-sm font-medium
                  transition-colors duration-150
                  ${
                    isSelected
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-card text-muted-foreground hover:border-primary'
                  }
                `}
              >
                {subject}
              </button>
            )
          })}
        </div>
      </div>

      {/* Levels */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">Teaching Levels</h3>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((level) => {
            const isSelected = selectedLevels.has(level)
            return (
              <button
                key={level}
                type="button"
                onClick={() => toggleLevel(level)}
                className={`
                  rounded-full border px-3 py-1.5 text-sm font-medium
                  transition-colors duration-150
                  ${
                    isSelected
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-card text-muted-foreground hover:border-primary'
                  }
                `}
              >
                {level}
              </button>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Continue */}
      <Button
        onClick={handleSubmit}
        loading={isPending}
        disabled={isPending}
        className="w-full"
        size="lg"
      >
        Continue
      </Button>
    </div>
  )
}
