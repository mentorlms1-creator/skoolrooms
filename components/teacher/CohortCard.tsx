/**
 * components/teacher/CohortCard.tsx — Cohort summary card for course detail page
 *
 * Server Component. Displays cohort name, date range, fee info,
 * student count, and display status. Links to cohort detail page.
 */

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ROUTES } from '@/constants/routes'
import { formatPKT } from '@/lib/time/pkt'

type CohortCardProps = {
  cohort: {
    id: string
    name: string
    start_date: string
    end_date: string
    fee_type: string
    fee_pkr: number
    billing_day: number | null
    max_students: number | null
  }
  courseId: string
  displayStatus: string
  enrollmentCount: number
}

export function CohortCard({
  cohort,
  courseId,
  displayStatus,
  enrollmentCount,
}: CohortCardProps) {
  const spotsLabel =
    cohort.max_students !== null
      ? `${enrollmentCount} / ${cohort.max_students} students`
      : `${enrollmentCount} student${enrollmentCount === 1 ? '' : 's'}`

  const feeLabel =
    cohort.fee_type === 'monthly'
      ? `PKR ${cohort.fee_pkr.toLocaleString()}/mo (billing day ${cohort.billing_day})`
      : `PKR ${cohort.fee_pkr.toLocaleString()} (one-time)`

  return (
    <Link href={ROUTES.TEACHER.cohortDetail(courseId, cohort.id)}>
      <Card hover className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-ink">
              {cohort.name}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {formatPKT(cohort.start_date, 'date')} &ndash;{' '}
              {formatPKT(cohort.end_date, 'date')}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
              <span>{feeLabel}</span>
              <span>&middot;</span>
              <span>{spotsLabel}</span>
            </div>
          </div>
          <StatusBadge status={displayStatus} size="sm" />
        </div>
      </Card>
    </Link>
  )
}
