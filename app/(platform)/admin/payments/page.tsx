/**
 * app/(platform)/admin/payments/page.tsx — Subscription verification queue
 *
 * Server Component. Shows pending subscription screenshots for admin approval/rejection.
 */

import type { Metadata } from 'next'
import { getPendingSubscriptions } from '@/lib/db/admin'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { SubscriptionQueue } from '@/components/admin/SubscriptionQueue'

export const metadata: Metadata = {
  title: 'Payments — Lumscribe Admin',
}

export default async function AdminPaymentsPage() {
  const pending = await getPendingSubscriptions()

  return (
    <>
      <PageHeader title="Payments" />

      <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
        <CardHeader className="px-8 pt-8 pb-4">
          <CardTitle className="text-xl font-bold">Subscription Queue</CardTitle>
          <CardDescription className="text-sm font-medium mt-1">
            Review and verify pending subscription screenshots
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          {pending.length === 0 ? (
            <div className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-6 text-center">
              <p className="text-sm text-muted-foreground">No pending subscriptions to review.</p>
            </div>
          ) : (
            <SubscriptionQueue subscriptions={pending} />
          )}
        </CardContent>
      </Card>
    </>
  )
}
