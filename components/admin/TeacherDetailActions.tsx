'use client'

/**
 * components/admin/TeacherDetailActions.tsx — Admin actions for teacher detail
 * Suspend/reactivate, change plan, extend expiry/trial, view-as, password reset.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  changePlanAction,
  extendExpiryAction,
  extendTrialAction,
  suspendTeacherAction,
  reactivateTeacherAction,
} from '@/lib/actions/admin'
import { generatePasswordResetLinkAction, startViewAsActionClient } from '@/lib/actions/admin-teacher-ops'
import { WipeTestAccountButton } from './WipeTestAccountButton'

type TeacherDetailActionsProps = {
  teacherId: string
  teacherEmail: string
  currentPlan: string
  isSuspended: boolean
}

export function TeacherDetailActions({
  teacherId,
  teacherEmail,
  currentPlan,
  isSuspended,
}: TeacherDetailActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [recoveryLink, setRecoveryLink] = useState<string | null>(null)
  const [showViewAsConfirm, setShowViewAsConfirm] = useState(false)

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

  async function handleGenerateRecoveryLink() {
    setLoading('recovery')
    setMessage(null)
    setRecoveryLink(null)

    const result = await generatePasswordResetLinkAction(teacherId)
    if (result.success) {
      setRecoveryLink(result.data.resetLink)
    } else {
      setMessage({ type: 'error', text: result.error })
    }

    setLoading(null)
  }

  async function handleViewAs() {
    setLoading('viewas')
    setShowViewAsConfirm(false)

    const result = await startViewAsActionClient(teacherId)
    if (result.success) {
      router.push('/dashboard')
    } else {
      setMessage({ type: 'error', text: result.error })
      setLoading(null)
    }
  }

  // Test account pattern check
  const isTestAccount =
    teacherEmail.includes('+test') || teacherEmail.endsWith('@test.skoolrooms.com')

  return (
    <>
      <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
        <CardHeader className="px-8 pt-8 pb-4">
          <CardTitle className="text-xl font-bold">Admin Actions</CardTitle>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          {message && (
            <div
              className={`mb-5 rounded-2xl px-5 py-4 text-sm font-medium ${
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
                className="w-full rounded-xl"
              >
                {isSuspended ? 'Reactivate Teacher' : 'Suspend Teacher'}
              </Button>
            </div>

            {/* View As */}
            <div>
              <Button
                variant="secondary"
                size="sm"
                loading={loading === 'viewas'}
                onClick={() => setShowViewAsConfirm(true)}
                className="w-full rounded-xl"
              >
                View As Teacher (Read-only)
              </Button>
            </div>

            {/* Change Plan */}
            <form onSubmit={handleChangePlan} className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
                Change Plan
              </h3>
              <Select name="plan" defaultValue={currentPlan}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="solo">Solo</SelectItem>
                  <SelectItem value="academy">Academy</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                loading={loading === 'plan'}
                className="w-full rounded-xl"
              >
                Update Plan
              </Button>
            </form>

            {/* Extend Plan Expiry */}
            <form onSubmit={handleExtendExpiry} className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
                Extend Plan Expiry
              </h3>
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
                className="w-full rounded-xl"
              >
                Extend Expiry
              </Button>
            </form>

            {/* Extend Trial */}
            <form onSubmit={handleExtendTrial} className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
                Extend Trial
              </h3>
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
                className="w-full rounded-xl"
              >
                Extend Trial
              </Button>
            </form>

            {/* Generate Recovery Link */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
                Emergency Password Reset
              </h3>
              <Button
                variant="secondary"
                size="sm"
                loading={loading === 'recovery'}
                onClick={handleGenerateRecoveryLink}
                className="w-full rounded-xl"
              >
                Generate Recovery Link
              </Button>
              {recoveryLink && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted-foreground">
                    Copy and share out-of-band. Single-use only.
                  </p>
                  <Input
                    readOnly
                    value={recoveryLink}
                    onFocus={(e) => e.target.select()}
                    className="font-mono text-xs"
                  />
                </div>
              )}
            </div>

            {/* Wipe Test Account — only shown for test accounts */}
            {isTestAccount && (
              <WipeTestAccountButton teacherId={teacherId} teacherEmail={teacherEmail} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* View-as confirmation dialog */}
      <Dialog open={showViewAsConfirm} onOpenChange={setShowViewAsConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>View as teacher?</DialogTitle>
            <DialogDescription>
              You will be redirected to the teacher dashboard in read-only mode. All writes will be
              blocked. The session expires in 30 minutes.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium text-foreground">{teacherEmail}</p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowViewAsConfirm(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleViewAs}>
              Start View-as Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
