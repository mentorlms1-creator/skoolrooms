/**
 * app/(platform)/admin/operations/page.tsx — Operations overview
 *
 * Server Component. Displays active cohorts, total students, pending payment queue count.
 */

import type { Metadata } from 'next'
import {
  BookOpen,
  GraduationCap,
  CreditCard,
} from 'lucide-react'
import { getOperationsStats } from '@/lib/db/admin'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Operations — Lumscribe Admin',
}

export default async function AdminOperationsPage() {
  const stats = await getOperationsStats()

  return (
    <>
      <PageHeader title="Operations" />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Active Cohorts"
          value={String(stats.totalActiveCohorts)}
          subtitle="Currently running cohorts across all teachers"
          icon={BookOpen}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <StatCard
          label="Total Students"
          value={String(stats.totalStudents)}
          subtitle="All registered students on the platform"
          icon={GraduationCap}
          iconColor="text-accent"
          iconBg="bg-accent/10"
        />
        <StatCard
          label="Pending Payments"
          value={String(stats.pendingPaymentCount)}
          subtitle="Payments awaiting verification"
          icon={CreditCard}
          iconColor="text-foreground"
          iconBg="bg-muted"
        />
      </div>
    </>
  )
}

interface StatCardProps {
  label: string
  value: string
  subtitle: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  iconBg: string
  iconColor: string
}

function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  iconBg,
  iconColor,
}: StatCardProps) {
  return (
    <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card h-full">
      <CardContent className="px-7 pt-7 pb-6 flex flex-col items-start gap-4 h-full">
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-2xl shrink-0',
            iconBg
          )}
        >
          <Icon className={cn('h-5 w-5', iconColor)} strokeWidth={2} />
        </div>

        <div className="flex flex-col gap-1 flex-1 justify-center">
          <span className="text-4xl font-extrabold tracking-tight text-foreground leading-none">
            {value}
          </span>
          <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-[0.08em]">
            {label}
          </p>
        </div>

        <p className="text-xs font-medium text-muted-foreground/60">{subtitle}</p>
      </CardContent>
    </Card>
  )
}
