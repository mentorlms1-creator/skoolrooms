/**
 * app/(platform)/admin/page.tsx — Admin dashboard home
 *
 * Server Component. Displays MRR, signup counts, plan distribution.
 */

import type { Metadata } from 'next'
import { getAdminDashboardStats, getOperationsStats } from '@/lib/db/admin'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Admin Dashboard \u2014 Lumscribe',
}

export default async function AdminDashboardPage() {
  const [stats, ops] = await Promise.all([
    getAdminDashboardStats(),
    getOperationsStats(),
  ])

  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        description="Platform overview and key metrics."
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Monthly Recurring Revenue"
          value={`PKR ${stats.mrr.toLocaleString()}`}
        />
        <StatCard
          label="Signups This Week"
          value={String(stats.signupsThisWeek)}
        />
        <StatCard
          label="Signups This Month"
          value={String(stats.signupsThisMonth)}
        />
        <StatCard
          label="Pending Payments"
          value={String(ops.pendingPaymentCount)}
        />
      </div>

      {/* Second row */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Active Cohorts"
          value={String(ops.totalActiveCohorts)}
        />
        <StatCard
          label="Total Students"
          value={String(ops.totalStudents)}
        />
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Plan Distribution</h3>
          <div className="mt-3 space-y-2">
            {stats.planDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">No teachers yet.</p>
            ) : (
              stats.planDistribution.map((item) => (
                <div key={item.plan} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground capitalize">
                    {item.plan}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {item.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
      <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
    </Card>
  )
}
