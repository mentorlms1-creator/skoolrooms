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
          <h3 className="text-sm font-medium text-muted-foreground">Active Cohorts</h3>
          <p className="mt-2 text-3xl font-bold text-foreground">{stats.totalActiveCohorts}</p>
          <p className="mt-1 text-xs text-muted-foreground">Currently running cohorts across all teachers</p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Total Students</h3>
          <p className="mt-2 text-3xl font-bold text-foreground">{stats.totalStudents}</p>
          <p className="mt-1 text-xs text-muted-foreground">All registered students on the platform</p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Pending Payments</h3>
          <p className="mt-2 text-3xl font-bold text-foreground">{stats.pendingPaymentCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Payments awaiting verification</p>
        </Card>
      </div>
    </>
  )
}
