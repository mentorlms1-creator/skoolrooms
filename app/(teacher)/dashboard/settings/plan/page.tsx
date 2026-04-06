/**
 * app/(teacher)/dashboard/settings/plan/page.tsx — Teacher plan management page
 *
 * Server Component. Shows:
 * - Current plan name, price, expiry/trial status
 * - Feature list (included vs locked)
 * - Usage bars for plan limits
 * - Upgrade/renew CTA
 * - Subscription history
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireTeacher } from '@/lib/auth/guards'
import { getTeacherPlanDetails, getTeacherUsage } from '@/lib/db/teachers'
import { getTeacherSubscriptions } from '@/lib/db/subscriptions'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { UsageBars } from '@/components/ui/UsageBars'
import { ROUTES } from '@/constants/routes'
import { PLANS, UNLIMITED_VALUE } from '@/constants/plans'
import { formatPKT } from '@/lib/time/pkt'
import type { PlanSlug } from '@/types/domain'

export const metadata: Metadata = {
  title: 'Plan & Subscription \u2014 Lumscribe',
}

// Feature display names for the feature list
const FEATURE_DISPLAY_NAMES: Record<string, string> = {
  attendance_tracking: 'Attendance Tracking',
  assignment_submission: 'Assignment Submissions',
  analytics_dashboard: 'Analytics Dashboard',
  student_portal: 'Student Portal',
  class_reminders: 'Class Reminders',
  whatsapp_notifications: 'WhatsApp Notifications',
  progress_report_pdf: 'Progress Report PDF',
  cohort_archive_history: 'Cohort Archive History',
  fee_reminders: 'Fee Reminders',
  revenue_analytics: 'Revenue Analytics',
  student_health_signals: 'Student Health Signals',
  custom_domain: 'Custom Domain',
  multi_teacher: 'Multi-Teacher Support',
  remove_branding: 'Remove Branding',
  recurring_classes: 'Recurring Classes',
  waitlist: 'Waitlist',
  discount_codes: 'Discount Codes',
}

export default async function PlanSettingsPage() {
  const teacher = await requireTeacher()
  const teacherId = teacher.id as string

  const [planDetails, usage, subscriptions] = await Promise.all([
    getTeacherPlanDetails(teacherId),
    getTeacherUsage(teacherId),
    getTeacherSubscriptions(teacherId),
  ])

  const currentPlan = teacher.plan as PlanSlug
  const planInfo = PLANS[currentPlan]
  const isFreePlan = currentPlan === 'free'
  const isTrialing = teacher.trial_ends_at
    ? new Date(teacher.trial_ends_at as string) > new Date()
    : false

  // Determine plan status text
  let planStatusText = ''
  let planStatusType = 'active'
  if (isFreePlan) {
    planStatusText = 'Active (Free Forever)'
  } else if (isTrialing) {
    planStatusText = `Trial (ends ${formatPKT(teacher.trial_ends_at as string, 'date')})`
    planStatusType = 'upcoming'
  } else if (teacher.plan_expires_at) {
    const expired = new Date(teacher.plan_expires_at as string) < new Date()
    if (expired) {
      planStatusText = 'Expired'
      planStatusType = 'expired'
    } else {
      planStatusText = `Active (expires ${formatPKT(teacher.plan_expires_at as string, 'date')})`
    }
  } else {
    planStatusText = 'Active'
  }

  // Build usage items for the bars
  const usageItems = [
    {
      label: 'Courses',
      current: usage.courses,
      max: planDetails?.limits.max_courses ?? 1,
    },
    {
      label: 'Students',
      current: usage.students,
      max: planDetails?.limits.max_students ?? 15,
    },
    {
      label: 'Active Cohorts',
      current: usage.cohortsActive,
      max: planDetails?.limits.max_cohorts_active ?? 1,
    },
    {
      label: 'Storage',
      current: usage.storageMb,
      max: planDetails?.limits.max_storage_mb ?? 500,
      unit: 'MB',
    },
  ]

  // Build enabled/disabled feature lists
  const enabledFeatures: string[] = []
  const disabledFeatures: string[] = []

  if (planDetails) {
    for (const [key, displayName] of Object.entries(FEATURE_DISPLAY_NAMES)) {
      if (planDetails.features[key]) {
        enabledFeatures.push(displayName)
      } else {
        disabledFeatures.push(displayName)
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan & Subscription"
        description="Manage your subscription plan and view usage"
      />

      {/* Current Plan Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{planInfo?.name ?? currentPlan} Plan</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {planInfo && planInfo.price_pkr > 0
                ? `Rs. ${planInfo.price_pkr.toLocaleString()} / month`
                : 'Free forever'}
            </p>
            <div className="mt-2">
              <StatusBadge status={planStatusType} />
              <span className="ml-2 text-sm text-muted-foreground">{planStatusText}</span>
            </div>
            {planInfo && planInfo.transaction_cut_percent > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Platform fee: {planInfo.transaction_cut_percent}% per student payment
              </p>
            )}
          </div>
          <div>
            {isFreePlan || (teacher.plan_expires_at && new Date(teacher.plan_expires_at as string) < new Date()) ? (
              <Link
                href={ROUTES.PLATFORM.subscribe}
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
              >
                Upgrade Plan
              </Link>
            ) : isTrialing ? (
              <Link
                href={ROUTES.PLATFORM.subscribe}
                className="inline-flex items-center rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
              >
                Subscribe Now
              </Link>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Usage */}
      <Card className="p-6">
        <h3 className="mb-4 text-base font-semibold text-foreground">Usage</h3>
        <UsageBars items={usageItems} />
      </Card>

      {/* Features */}
      <Card className="p-6">
        <h3 className="mb-4 text-base font-semibold text-foreground">Features</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Included features */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-success">Included</h4>
            <ul className="space-y-1.5">
              {enabledFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle />
                  {f}
                </li>
              ))}
              {enabledFeatures.length === 0 && (
                <li className="text-sm text-muted-foreground">Core features (courses, cohorts, payments, subdomain) are included with every plan.</li>
              )}
            </ul>
          </div>

          {/* Locked features */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">Not Available</h4>
            <ul className="space-y-1.5">
              {disabledFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LockIcon />
                  {f}
                </li>
              ))}
              {disabledFeatures.length === 0 && (
                <li className="text-sm text-success">All features available!</li>
              )}
            </ul>
          </div>
        </div>
      </Card>

      {/* Subscription History */}
      {subscriptions.length > 0 && (
        <Card className="p-6">
          <h3 className="mb-4 text-base font-semibold text-foreground">Subscription History</h3>
          {/* Mobile card view */}
          <div className="md:hidden flex flex-col gap-3">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="rounded-md border border-border p-3 sm:p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground capitalize">{sub.plan}</span>
                  <StatusBadge status={sub.status} size="sm" />
                </div>
                <p className="mt-1 text-foreground">Rs. {sub.amount_pkr.toLocaleString()}</p>
                <p className="mt-1 text-muted-foreground">
                  {formatPKT(sub.period_start, 'date')} &mdash; {formatPKT(sub.period_end, 'date')}
                </p>
                <p className="mt-1 text-muted-foreground">{formatPKT(sub.created_at, 'date')}</p>
              </div>
            ))}
          </div>
          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Plan</th>
                  <th className="pb-2 pr-4 font-medium">Amount</th>
                  <th className="pb-2 pr-4 font-medium">Period</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="border-b border-border/50">
                    <td className="py-2.5 pr-4 font-medium text-foreground capitalize">{sub.plan}</td>
                    <td className="py-2.5 pr-4 text-foreground">Rs. {sub.amount_pkr.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {formatPKT(sub.period_start, 'date')} &mdash;{' '}
                      {formatPKT(sub.period_end, 'date')}
                    </td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge status={sub.status} size="sm" />
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {formatPKT(sub.created_at, 'date')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// -- Icons --

function CheckCircle() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4 shrink-0 text-success"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4 shrink-0 text-muted-foreground"
    >
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
        clipRule="evenodd"
      />
    </svg>
  )
}
