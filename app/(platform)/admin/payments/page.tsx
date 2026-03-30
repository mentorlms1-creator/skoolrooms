/**
 * app/(platform)/admin/payments/page.tsx — Subscription verification queue
 *
 * Server Component. Shows pending subscription screenshots for admin approval/rejection.
 */

import { getPendingSubscriptions } from '@/lib/db/admin'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { SubscriptionQueue } from '@/components/admin/SubscriptionQueue'

export default async function AdminPaymentsPage() {
  const pending = await getPendingSubscriptions()

  return (
    <>
      <PageHeader
        title="Subscription Payments"
        description="Review and verify pending subscription screenshots."
      />

      {pending.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted">No pending subscriptions to review.</p>
        </Card>
      ) : (
        <SubscriptionQueue subscriptions={pending} />
      )}
    </>
  )
}
