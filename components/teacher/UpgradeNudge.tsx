/**
 * components/teacher/UpgradeNudge.tsx — Banner prompting teachers to upgrade their plan
 *
 * Server Component (no 'use client'). Renders a colored banner showing usage
 * against plan limits, with an "Upgrade" link to the plan settings page.
 *
 * Severity controls banner color:
 *   - warning: amber tones (approaching limit)
 *   - danger: red tones (at limit)
 */

import Link from 'next/link'
import { ROUTES } from '@/constants/routes'

type UpgradeNudgeProps = {
  label: string
  current: number
  max: number
  severity: 'warning' | 'danger'
}

const severityClasses: Record<'warning' | 'danger', string> = {
  warning: 'bg-warning/10 border-warning/20 text-warning',
  danger: 'bg-danger/10 border-danger/20 text-danger',
}

export function UpgradeNudge({ label, current, max, severity }: UpgradeNudgeProps) {
  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 rounded-lg border px-4 py-3 text-sm ${severityClasses[severity]}`}
      role="alert"
    >
      <p>
        You&apos;re using <strong>{current}</strong> of <strong>{max}</strong> {label}.
      </p>
      <Link
        href={ROUTES.TEACHER.settings.plan}
        className="w-full sm:w-auto text-center shrink-0 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
      >
        Upgrade
      </Link>
    </div>
  )
}
