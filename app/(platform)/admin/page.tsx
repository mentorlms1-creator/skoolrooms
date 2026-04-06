/**
 * app/(platform)/admin/page.tsx — Admin dashboard home
 *
 * Server Component. Displays bento grid with KPIs, charts, and recent teachers.
 * Charts are client components loaded via dynamic import (no SSR).
 */

import type { Metadata } from 'next'
import {
  TrendingUp,
  UserPlus,
  CreditCard,
  Users,
  GraduationCap,
  CalendarCheck,
} from 'lucide-react'
import {
  getAdminDashboardStats,
  getOperationsStats,
  getRecentTeachers,
  getRevenueByCohort,
} from '@/lib/db/admin'
import { formatPKT } from '@/lib/time/pkt'
import { PageHeader } from '@/components/ui/PageHeader'
import { DateRangeFilter } from '@/components/ui/DateRangeFilter'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { RevenueChart } from './RevenueChart'
import { PlanChart } from './PlanChart'

export const metadata: Metadata = {
  title: 'Admin Dashboard — Lumscribe',
}

export default async function AdminDashboardPage() {
  const [stats, ops, recentTeachers, revenueByCohort] = await Promise.all([
    getAdminDashboardStats(),
    getOperationsStats(),
    getRecentTeachers(),
    getRevenueByCohort(),
  ])

  return (
    <>
      <PageHeader
        title="Hello, Admin!"
        description="Here's your platform overview"
        filter={<DateRangeFilter />}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {/* Row 1: Four stat cards */}
        <StatCard
          label="Monthly Recurring Revenue"
          value={`PKR ${stats.mrr.toLocaleString()}`}
          icon={TrendingUp}
          iconBg="bg-primary/10"
        />
        <StatCard
          label="Signups This Week"
          value={String(stats.signupsThisWeek)}
          icon={UserPlus}
          iconBg="bg-success/10"
        />
        <StatCard
          label="Pending Payments"
          value={String(ops.pendingPaymentCount)}
          icon={CreditCard}
          iconBg="bg-warning/10"
        />
        <StatCard
          label="Active Cohorts"
          value={String(ops.totalActiveCohorts)}
          icon={Users}
          iconBg="bg-accent/10"
        />

        {/* Row 2: Revenue chart (2x1) + Plan distribution donut (2x1) */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Revenue by Cohort</CardTitle>
            <CardDescription>Top cohorts by confirmed payments</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueByCohort} />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Plan Distribution</CardTitle>
            <CardDescription>Teachers by subscription plan</CardDescription>
          </CardHeader>
          <CardContent>
            <PlanChart data={stats.planDistribution} />
          </CardContent>
        </Card>

        {/* Row 3: Recent teachers (2x1) + Total Students (1x1) + Signups This Month (1x1) */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Recent Teachers</CardTitle>
            <CardDescription>Latest signups</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTeachers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No teachers have signed up yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentTeachers.map((teacher) => (
                  <div
                    key={teacher.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {teacher.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {teacher.email}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {teacher.plan}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatPKT(teacher.created_at, 'date')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <StatCard
          label="Total Students"
          value={String(ops.totalStudents)}
          icon={GraduationCap}
          iconBg="bg-primary/10"
        />
        <StatCard
          label="Signups This Month"
          value={String(stats.signupsThisMonth)}
          icon={CalendarCheck}
          iconBg="bg-success/10"
        />
      </div>
    </>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
}: {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
  iconBg?: string
}) {
  return (
    <Card>
      <CardContent className="p-7">
        {Icon && (
          <div
            className={cn(
              'mb-3 flex h-10 w-10 items-center justify-center rounded-xl',
              iconBg || 'bg-primary/10'
            )}
          >
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
        <p className="text-4xl font-extrabold text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground/70">{label}</p>
      </CardContent>
    </Card>
  )
}
