/**
 * app/(teacher)/dashboard/payments/page.tsx — Payment Verification page (Server Component)
 * Fetches pending enrollments and renders the verification panel.
 */

import type { Metadata } from 'next'
import { requireTeacher } from '@/lib/auth/guards'
import { getPendingEnrollmentsByTeacher } from '@/lib/db/enrollments'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { PaymentVerificationPanel } from './panel'

export const metadata: Metadata = {
  title: 'Payments \u2014 Skool Rooms',
}

export default async function PaymentVerificationPage() {
  const teacher = await requireTeacher()
  const pendingEnrollments = await getPendingEnrollmentsByTeacher(teacher.id)

  return (
    <div>
      <PageHeader
        title="Payment Verification"
        description="Review and verify pending student payments"
      />

      {pendingEnrollments.length === 0 ? (
        <EmptyState
          title="No pending payments"
          description="All student payments have been reviewed. New payments will appear here when students submit them."
        />
      ) : (
        <PaymentVerificationPanel enrollments={pendingEnrollments} />
      )}
    </div>
  )
}
