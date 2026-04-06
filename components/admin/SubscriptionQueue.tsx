'use client'

/**
 * components/admin/SubscriptionQueue.tsx — Pending subscription approval/rejection
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatPKT } from '@/lib/time/pkt'
import {
  approveSubscriptionAction,
  rejectSubscriptionAction,
} from '@/lib/actions/subscriptions'
import type { PendingSubscriptionRow } from '@/lib/db/admin'

type SubscriptionQueueProps = {
  subscriptions: PendingSubscriptionRow[]
}

export function SubscriptionQueue({ subscriptions }: SubscriptionQueueProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleApprove(id: string) {
    setLoadingId(id)
    setMessage(null)
    const result = await approveSubscriptionAction(id)
    if (result.success) {
      setMessage({ type: 'success', text: 'Subscription approved.' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error })
    }
    setLoadingId(null)
  }

  async function handleReject(id: string) {
    setLoadingId(id)
    setMessage(null)
    const formData = new FormData()
    formData.set('reason', 'Rejected by admin')
    const result = await rejectSubscriptionAction(id, formData)
    if (result.success) {
      setMessage({ type: 'success', text: 'Subscription rejected.' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error })
    }
    setLoadingId(null)
  }

  return (
    <div className="space-y-5">
      {message && (
        <div
          className={`rounded-2xl px-5 py-4 text-sm font-medium ${
            message.type === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      {subscriptions.map((sub) => (
        <div
          key={sub.id}
          className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-6"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1 space-y-4">
              {/* Teacher name + status */}
              <div className="flex items-center gap-3">
                <h3 className="text-[15px] font-bold text-foreground">{sub.teacher_name}</h3>
                <StatusBadge status={sub.status} size="sm" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                {sub.teacher_email}
              </p>

              {/* Info grid */}
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Plan</span>
                  <p className="mt-0.5 font-bold text-foreground capitalize">{sub.plan}</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Amount</span>
                  <p className="mt-0.5 font-bold text-foreground">PKR {sub.amount_pkr.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Method</span>
                  <p className="mt-0.5 font-bold text-foreground capitalize">{sub.payment_method}</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Period</span>
                  <p className="mt-0.5 text-foreground">
                    {formatPKT(sub.period_start, 'date')} - {formatPKT(sub.period_end, 'date')}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Submitted</span>
                  <p className="mt-0.5 text-foreground">{formatPKT(sub.created_at, 'datetime')}</p>
                </div>
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

            {/* Action buttons */}
            <div className="flex gap-3 sm:flex-col">
              <Button
                variant="primary"
                size="sm"
                loading={loadingId === sub.id}
                onClick={() => handleApprove(sub.id)}
                className="rounded-xl"
              >
                Approve
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={loadingId === sub.id}
                onClick={() => handleReject(sub.id)}
                className="rounded-xl"
              >
                Reject
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
