/**
 * app/(platform)/admin/operations/page.tsx — Operations overview
 *
 * Server Component. Displays active cohorts, total students, pending payment queue count.
 */

import type { Metadata } from 'next'
import { getOperationsStats } from '@/lib/db/admin'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

export const metadata: Metadata = {
  title: 'Operations \u2014 Lumscribe Admin',
}

export default async function AdminOperationsPage() {
  const stats = await getOperationsStats()

  return (
    <>
      <PageHeader
        title="Operations"
        description="Platform operations overview."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted">Active Cohorts</h3>
          <p className="mt-2 text-3xl font-bold text-ink">{stats.totalActiveCohorts}</p>
          <p className="mt-1 text-xs text-muted">Currently running cohorts across all teachers</p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted">Total Students</h3>
          <p className="mt-2 text-3xl font-bold text-ink">{stats.totalStudents}</p>
          <p className="mt-1 text-xs text-muted">All registered students on the platform</p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted">Pending Payments</h3>
          <p className="mt-2 text-3xl font-bold text-ink">{stats.pendingPaymentCount}</p>
          <p className="mt-1 text-xs text-muted">Payments awaiting verification</p>
        </Card>
      </div>
    </>
  )
}
