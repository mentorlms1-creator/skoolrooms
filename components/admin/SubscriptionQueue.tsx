'use client'

/**
 * components/admin/SubscriptionQueue.tsx — Pending subscription approval/rejection
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
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
    <div className="space-y-4">
      {message && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-danger/10 text-danger'
          }`}
        >
          {message.text}
        </div>
      )}

      {subscriptions.map((sub) => (
        <Card key={sub.id} className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-ink">{sub.teacher_name}</h3>
                <StatusBadge status={sub.status} size="sm" />
              </div>
              <p className="text-xs text-muted">{sub.teacher_email}</p>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <span className="text-xs text-muted">Plan:</span>{' '}
                  <span className="font-medium text-ink capitalize">{sub.plan}</span>
                </div>
                <div>
                  <span className="text-xs text-muted">Amount:</span>{' '}
                  <span className="font-medium text-ink">PKR {sub.amount_pkr.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-xs text-muted">Method:</span>{' '}
                  <span className="font-medium text-ink capitalize">{sub.payment_method}</span>
                </div>
                <div>
                  <span className="text-xs text-muted">Period:</span>{' '}
                  <span className="text-ink">
                    {formatPKT(sub.period_start, 'date')} - {formatPKT(sub.period_end, 'date')}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted">Submitted:</span>{' '}
                  <span className="text-ink">{formatPKT(sub.created_at, 'datetime')}</span>
                </div>
              </div>
              {sub.screenshot_url && (
                <div className="mt-2">
                  <a
                    href={sub.screenshot_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-600 hover:text-brand-500"
                  >
                    View Screenshot
                  </a>
                </div>
              )}
            </div>

            <div className="flex gap-2 sm:flex-col">
              <Button
                variant="primary"
                size="sm"
                loading={loadingId === sub.id}
                onClick={() => handleApprove(sub.id)}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={loadingId === sub.id}
                onClick={() => handleReject(sub.id)}
              >
                Reject
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
