/**
 * app/(platform)/admin/payments/page.tsx — Subscription verification + history
 *
 * Server Component. Two tabs:
 *  - Pending: SubscriptionQueue (approve/reject queue)
 *  - History: Approved / rejected subscriptions with screenshot proof
 *    still viewable for audit and dispute resolution.
 */

import type { Metadata } from 'next'
import { Link } from 'next-view-transitions'
import { CheckCircle2, XCircle } from 'lucide-react'
import {
  getPendingSubscriptions,
  getSubscriptionHistory,
  type SubscriptionHistoryRow,
} from '@/lib/db/admin'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SubscriptionQueue } from '@/components/admin/SubscriptionQueue'
import { formatPKT } from '@/lib/time/pkt'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Payments — Skool Rooms Admin',
}

type Tab = 'pending' | 'history'

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab: Tab = tab === 'history' ? 'history' : 'pending'

  const [pending, history] = await Promise.all([
    getPendingSubscriptions(),
    getSubscriptionHistory(),
  ])

  return (
    <>
      <PageHeader title="Payments" />

      {/* Segmented tab nav */}
      <div className="mb-5 inline-flex w-fit items-center gap-1 rounded-2xl bg-card ring-1 ring-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-1">
        <TabLink
          href="?tab=pending"
          active={activeTab === 'pending'}
          label="Pending"
          count={pending.length}
          countTone={pending.length > 0 ? 'warning' : 'muted'}
        />
        <TabLink
          href="?tab=history"
          active={activeTab === 'history'}
          label="History"
          count={history.length}
          countTone="muted"
        />
      </div>

      <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
        <CardHeader className="px-8 pt-8 pb-4">
          <CardTitle className="text-xl font-bold">
            {activeTab === 'pending' ? 'Subscription Queue' : 'Decision History'}
          </CardTitle>
          <CardDescription className="text-sm font-medium mt-1">
            {activeTab === 'pending'
              ? 'Review and verify pending subscription screenshots'
              : 'Approved and rejected subscriptions — screenshots remain viewable for audit.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          {activeTab === 'pending' ? (
            pending.length === 0 ? (
              <EmptyPanel text="No pending subscriptions to review." />
            ) : (
              <SubscriptionQueue subscriptions={pending} />
            )
          ) : history.length === 0 ? (
            <EmptyPanel text="No past decisions yet. Once you approve or reject subscriptions, they'll appear here." />
          ) : (
            <div className="space-y-5">
              {history.map((sub) => (
                <SubscriptionHistoryCard key={sub.id} sub={sub} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
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

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-6 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

function SubscriptionHistoryCard({ sub }: { sub: SubscriptionHistoryRow }) {
  const isApproved = sub.status === 'active'

  return (
    <div className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-4">
          {/* Teacher name + status */}
          <div className="flex items-center gap-3">
            <h3 className="text-[15px] font-bold text-foreground">{sub.teacher_name}</h3>
            <StatusBadge
              status={isApproved ? 'approved' : 'rejected'}
              size="sm"
            />
          </div>
          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
            {sub.teacher_email}
          </p>

          {/* Info grid */}
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <Info label="Plan" value={sub.plan} capitalize />
            <Info label="Amount" value={`PKR ${sub.amount_pkr.toLocaleString()}`} />
            <Info label="Method" value={sub.payment_method} capitalize />
            <Info
              label="Period"
              value={`${formatPKT(sub.period_start, 'date')} - ${formatPKT(sub.period_end, 'date')}`}
              muted
            />
            <Info label="Submitted" value={formatPKT(sub.created_at, 'datetime')} muted />
            {isApproved && sub.approved_at && (
              <Info label="Approved" value={formatPKT(sub.approved_at, 'datetime')} muted />
            )}
          </div>

          {/* Screenshot link */}
          {sub.screenshot_url && (
            <div className="mt-1">
              <a
                href={sub.screenshot_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/90 transition-colors"
              >
                View Screenshot
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Decision footer */}
      <div className="mt-5 border-t border-foreground/[0.04] pt-4">
        {isApproved ? (
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Approved
              {sub.approved_at && (
                <span className="text-muted-foreground">
                  {' '}· {formatPKT(sub.approved_at, 'datetime')}
                </span>
              )}
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>Rejected</span>
            </div>
            {sub.rejection_reason && (
              <p className="rounded-xl bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Reason: </span>
                {sub.rejection_reason}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Info({
  label,
  value,
  capitalize = false,
  muted = false,
}: {
  label: string
  value: string
  capitalize?: boolean
  muted?: boolean
}) {
  return (
    <div>
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
        {label}
      </span>
      <p
        className={cn(
          'mt-0.5',
          muted ? 'text-foreground' : 'font-bold text-foreground',
          capitalize && 'capitalize',
        )}
      >
        {value}
      </p>
    </div>
  )
}
