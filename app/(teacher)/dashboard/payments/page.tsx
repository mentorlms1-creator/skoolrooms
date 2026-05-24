/**
 * app/(teacher)/dashboard/payments/page.tsx — Payment Verification page
 *
 * Server Component. Two tabs:
 *  - Pending: PaymentVerificationPanel (approve/reject queue)
 *  - History: Verified / rejected / refunded payments with screenshot proof
 *    still viewable for audit and dispute resolution.
 */

import type { Metadata } from 'next'
import { Link } from 'next-view-transitions'
import { requireTeacher } from '@/lib/auth/guards'
import {
  getPendingEnrollmentsByTeacher,
  getPaymentHistoryByTeacher,
} from '@/lib/db/enrollments'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { PaymentCard } from '@/components/teacher/PaymentCard'
import { PaymentVerificationPanel } from './panel'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Payments — Skool Rooms',
}

type Tab = 'pending' | 'history'

export default async function PaymentVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab: Tab = tab === 'history' ? 'history' : 'pending'

  const teacher = await requireTeacher()
  const [pendingEnrollments, history] = await Promise.all([
    getPendingEnrollmentsByTeacher(teacher.id),
    getPaymentHistoryByTeacher(teacher.id),
  ])

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Review pending payments and look up past decisions."
      />

      {/* Segmented tab nav */}
      <div className="mb-5 inline-flex w-fit items-center gap-1 rounded-2xl bg-card ring-1 ring-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-1">
        <TabLink
          href="?tab=pending"
          active={activeTab === 'pending'}
          label="Pending"
          count={pendingEnrollments.length}
          countTone={pendingEnrollments.length > 0 ? 'warning' : 'muted'}
        />
        <TabLink
          href="?tab=history"
          active={activeTab === 'history'}
          label="History"
          count={history.length}
          countTone="muted"
        />
      </div>

      {activeTab === 'pending' ? (
        pendingEnrollments.length === 0 ? (
          <EmptyState
            title="No pending payments"
            description="All student payments have been reviewed. New payments will appear here when students submit them."
          />
        ) : (
          <PaymentVerificationPanel enrollments={pendingEnrollments} />
        )
      ) : history.length === 0 ? (
        <EmptyState
          title="No past payments yet"
          description="Once you approve or reject student payments, they'll appear here for reference."
        />
      ) : (
        <div className="space-y-4">
          {history.map((payment) => (
            <PaymentCard
              key={payment.id}
              enrollmentId={payment.enrollments.id}
              referenceCode={payment.enrollments.reference_code}
              student={payment.enrollments.students}
              cohort={payment.enrollments.cohorts}
              payment={{
                id: payment.id,
                amount_pkr: payment.amount_pkr,
                discounted_amount_pkr: payment.discounted_amount_pkr,
                payment_method: payment.payment_method,
                screenshot_url: payment.screenshot_url,
                status: payment.status,
                created_at: payment.created_at,
                updated_at: payment.updated_at,
                verified_at: payment.verified_at,
                refunded_at: payment.refunded_at,
                rejection_reason: payment.rejection_reason,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TabLink({
  href,
  active,
  label,
  count,
  countTone,
}: {
  href: string
  active: boolean
  label: string
  count: number
  countTone: 'warning' | 'muted'
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
      aria-current={active ? 'page' : undefined}
    >
      {label}
      {count > 0 && (
        <span
          className={cn(
            'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold',
            active
              ? 'bg-primary-foreground/20 text-primary-foreground'
              : countTone === 'warning'
                ? 'bg-warning/15 text-warning'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {count}
        </span>
      )}
    </Link>
  )
}
