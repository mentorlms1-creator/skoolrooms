'use client'

/**
 * components/admin/TeacherDetailActions.tsx — Admin actions for teacher detail
 * Suspend/reactivate, change plan, extend expiry/trial.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/card'
import {
  changePlanAction,
  extendExpiryAction,
  extendTrialAction,
  suspendTeacherAction,
  reactivateTeacherAction,
} from '@/lib/actions/admin'

type TeacherDetailActionsProps = {
  teacherId: string
  currentPlan: string
  isSuspended: boolean
}

export function TeacherDetailActions({
  teacherId,
  currentPlan,
  isSuspended,
}: TeacherDetailActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSuspendToggle() {
    setLoading('suspend')
    setMessage(null)

    const result = isSuspended
      ? await reactivateTeacherAction(teacherId)
      : await suspendTeacherAction(teacherId)

    if (result.success) {
      setMessage({ type: 'success', text: isSuspended ? 'Teacher reactivated.' : 'Teacher suspended.' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error })
    }

    setLoading(null)
  }

  async function handleChangePlan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading('plan')
    setMessage(null)

    const formData = new FormData(e.currentTarget)
    const result = await changePlanAction(teacherId, formData)

    if (result.success) {
      setMessage({ type: 'success', text: 'Plan updated.' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error })
    }

    setLoading(null)
  }

  async function handleExtendExpiry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading('expiry')
    setMessage(null)

    const formData = new FormData(e.currentTarget)
    const result = await extendExpiryAction(teacherId, formData)

    if (result.success) {
      setMessage({ type: 'success', text: 'Plan expiry extended.' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error })
    }

    setLoading(null)
  }

  async function handleExtendTrial(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading('trial')
    setMessage(null)

    const formData = new FormData(e.currentTarget)
    const result = await extendTrialAction(teacherId, formData)

    if (result.success) {
      setMessage({ type: 'success', text: 'Trial extended.' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error })
    }

    setLoading(null)
  }

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">Admin Actions</h2>

      {message && (
        <div
          className={`mb-4 rounded-md px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Suspend / Reactivate */}
        <div>
          <Button
            variant={isSuspended ? 'primary' : 'danger'}
            size="sm"
            loading={loading === 'suspend'}
            onClick={handleSuspendToggle}
            className="w-full"
          >
            {isSuspended ? 'Reactivate Teacher' : 'Suspend Teacher'}
          </Button>
        </div>

        {/* Change Plan */}
        <form onSubmit={handleChangePlan} className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Change Plan</h3>
          <Select
            name="plan"
            options={[
              { value: 'free', label: 'Free' },
              { value: 'solo', label: 'Solo' },
              { value: 'academy', label: 'Academy' },
            ]}
            defaultValue={currentPlan}
          />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            loading={loading === 'plan'}
            className="w-full"
          >
            Update Plan
          </Button>
        </form>

        {/* Extend Plan Expiry */}
        <form onSubmit={handleExtendExpiry} className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Extend Plan Expiry</h3>
          <Input
            name="days"
            type="number"
            placeholder="Days to add"
            min={1}
            max={365}
            required
          />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            loading={loading === 'expiry'}
            className="w-full"
          >
            Extend Expiry
          </Button>
        </form>

        {/* Extend Trial */}
        <form onSubmit={handleExtendTrial} className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Extend Trial</h3>
          <Input
            name="days"
            type="number"
            placeholder="Days to add"
            min={1}
            max={365}
            required
          />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            loading={loading === 'trial'}
            className="w-full"
          >
            Extend Trial
          </Button>
        </form>
      </div>
    </Card>
  )
}
