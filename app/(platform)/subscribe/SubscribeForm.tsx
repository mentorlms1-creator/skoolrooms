'use client'

/**
 * app/(platform)/subscribe/SubscribeForm.tsx — Interactive subscription form
 *
 * Steps:
 * 1. Select plan (Solo or Academy)
 * 2. Submit → subscribeAction
 * 3. If trial started: show success message
 * 4. If needs screenshot: show upload form
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PLANS } from '@/constants/plans'
import { ROUTES } from '@/constants/routes'
import {
  subscribeAction,
  submitSubscriptionScreenshotAction,
} from '@/lib/actions/subscriptions'

type SubscribeFormProps = {
  currentPlan: string
  teacherName: string
}

type FormStep = 'select_plan' | 'upload_screenshot' | 'trial_success' | 'screenshot_submitted'

export function SubscribeForm({ currentPlan, teacherName }: SubscribeFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<FormStep>('select_plan')
  const [selectedPlan, setSelectedPlan] = useState<string>('')
  const [error, setError] = useState<string>('')

  // Screenshot form state
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [transactionId, setTransactionId] = useState('')

  const paidPlans = [PLANS.solo, PLANS.academy]

  function handleSelectPlan(planSlug: string) {
    setSelectedPlan(planSlug)
    setError('')

    startTransition(async () => {
      const formData = new FormData()
      formData.set('planSlug', planSlug)

      const result = await subscribeAction(formData)

      if (!result.success) {
        setError(result.error)
        return
      }

      if (result.data.trialStarted) {
        setStep('trial_success')
      } else {
        setStep('upload_screenshot')
      }
    })
  }

  function handleSubmitScreenshot() {
    if (!screenshotUrl.trim()) {
      setError('Please provide a screenshot URL')
      return
    }

    setError('')
    startTransition(async () => {
      const formData = new FormData()
      formData.set('planSlug', selectedPlan)
      formData.set('screenshotUrl', screenshotUrl.trim())
      formData.set('transactionId', transactionId.trim())

      const result = await submitSubscriptionScreenshotAction(formData)

      if (!result.success) {
        setError(result.error)
        return
      }

      setStep('screenshot_submitted')
    })
  }

  // ── Trial Success ──
  if (step === 'trial_success') {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-success">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-foreground">Trial Started!</h2>
        <p className="mt-2 text-muted-foreground">
          Welcome to the {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} plan, {teacherName}! You have 14 days to
          explore all premium features for free.
        </p>
        <Button
          className="mt-6"
          onClick={() => router.push(ROUTES.TEACHER.dashboard)}
        >
          Go to Dashboard
        </Button>
      </Card>
    )
  }

  // ── Screenshot Submitted ──
  if (step === 'screenshot_submitted') {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-warning">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-foreground">Screenshot Submitted!</h2>
        <p className="mt-2 text-muted-foreground">
          Your payment screenshot has been submitted for verification. Our team will review it
          within 24-48 hours. You will receive an email once approved.
        </p>
        <Button
          variant="secondary"
          className="mt-6"
          onClick={() => router.push(ROUTES.TEACHER.settings.plan)}
        >
          View Plan Settings
        </Button>
      </Card>
    )
  }

  // ── Upload Screenshot ──
  if (step === 'upload_screenshot') {
    const plan = PLANS[selectedPlan as keyof typeof PLANS]
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground">
          Pay for {plan?.name ?? selectedPlan} Plan
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Transfer Rs. {plan?.price_pkr.toLocaleString()} to our account and upload a screenshot of
          the payment.
        </p>

        {/* Payment details */}
        <div className="mt-4 rounded-lg border border-border bg-background p-4">
          <h3 className="text-sm font-medium text-foreground">Payment Details</h3>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <p>Bank: (Bank details will be configured in admin settings)</p>
            <p>Amount: <strong className="text-foreground">Rs. {plan?.price_pkr.toLocaleString()}</strong></p>
            <p>You can pay via bank transfer, JazzCash, or EasyPaisa.</p>
          </div>
        </div>

        {/* Screenshot URL input */}
        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="screenshotUrl" className="block text-sm font-medium text-foreground">
              Screenshot URL <span className="text-destructive">*</span>
            </label>
            <Input
              id="screenshotUrl"
              type="url"
              placeholder="https://..."
              value={screenshotUrl}
              onChange={(e) => setScreenshotUrl(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Upload your screenshot and paste the URL here. Must start with https://
            </p>
          </div>

          <div>
            <label htmlFor="transactionId" className="block text-sm font-medium text-foreground">
              Transaction ID (optional)
            </label>
            <Input
              id="transactionId"
              type="text"
              placeholder="e.g., TXN123456"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="mt-1"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleSubmitScreenshot}
              loading={isPending}
              disabled={!screenshotUrl.trim()}
            >
              Submit Screenshot
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setStep('select_plan')
                setSelectedPlan('')
                setError('')
              }}
              disabled={isPending}
            >
              Back
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  // ── Select Plan ──
  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {paidPlans.map((plan) => {
          const isCurrent = plan.slug === currentPlan
          return (
            <Card
              key={plan.slug}
              className={`relative p-6 ${plan.is_featured ? 'ring-2 ring-primary' : ''}`}
            >
              {plan.is_featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                  Most Popular
                </span>
              )}

              <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-2xl font-bold text-foreground">
                  Rs. {plan.price_pkr.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground"> / month</span>
              </div>

              <ul className="mt-4 space-y-2 text-sm text-foreground">
                <li>Up to {plan.limits.max_courses >= 9999 ? 'unlimited' : plan.limits.max_courses} courses</li>
                <li>Up to {plan.limits.max_students} students</li>
                <li>{plan.limits.max_cohorts_active >= 9999 ? 'Unlimited' : `Up to ${plan.limits.max_cohorts_active}`} cohorts</li>
                <li>{plan.limits.max_storage_mb >= 1024 ? `${plan.limits.max_storage_mb / 1024} GB` : `${plan.limits.max_storage_mb} MB`} storage</li>
                {plan.limits.max_teachers > 1 && (
                  <li>Up to {plan.limits.max_teachers} teachers</li>
                )}
              </ul>

              <div className="mt-6">
                <Button
                  onClick={() => handleSelectPlan(plan.slug)}
                  loading={isPending && selectedPlan === plan.slug}
                  disabled={isPending || isCurrent}
                  variant={plan.is_featured ? 'primary' : 'outline'}
                  className="w-full"
                >
                  {isCurrent ? 'Current Plan' : 'Select Plan'}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
