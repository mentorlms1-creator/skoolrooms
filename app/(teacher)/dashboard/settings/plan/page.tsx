/**
 * app/(teacher)/dashboard/settings/plan/page.tsx — Teacher plan management page
 *
 * Server Component. Shows:
 * - Current plan name, price, expiry/trial status, grandfathered badge
 * - Full feature/limit table with check/lock icons + "Was" column when grandfathered
 * - Usage bars for plan limits
 * - Upgrade/renew CTA
 * Subscription history lives at /dashboard/settings/billing (Lane E2 split).
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireTeacher } from '@/lib/auth/guards'
import {
  getTeacherPlanDetails,
  getTeacherPlanSnapshot,
  getTeacherUsage,
} from '@/lib/db/teachers'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { UsageBars } from '@/components/ui/UsageBars'
import { PlanFeatureIcon } from '@/components/ui/PlanFeatureIcon'
import { Badge } from '@/components/ui/badge'
import { ROUTES } from '@/constants/routes'
import { PLANS, UNLIMITED_VALUE } from '@/constants/plans'
import { FEATURE_REGISTRY } from '@/constants/features'
import { formatPKT } from '@/lib/time/pkt'
import type { PlanSlug, FeatureKey } from '@/types/domain'

export const metadata: Metadata = {
  title: 'Plan & Subscription \u2014 Skool Rooms',
}

const LIMIT_DISPLAY: Array<{ key: string; label: string; suffix?: string }> = [
  { key: 'max_courses', label: 'Courses' },
  { key: 'max_students', label: 'Students' },
  { key: 'max_cohorts_active', label: 'Active Cohorts' },
  { key: 'max_storage_mb', label: 'Storage', suffix: ' MB' },
]

function formatLimit(value: number | null | undefined, suffix?: string): string {
  if (value === null || value === undefined) return '—'
  if (value >= UNLIMITED_VALUE) return 'Unlimited'
  return `${value.toLocaleString()}${suffix ?? ''}`
}

export default async function PlanSettingsPage() {
  const teacher = await requireTeacher()
  const teacherId = teacher.id as string

  const [planDetails, usage] = await Promise.all([
    getTeacherPlanDetails(teacherId),
    getTeacherUsage(teacherId),
  ])
  const snapshot = await getTeacherPlanSnapshot(teacherId, planDetails)

  const currentPlan = teacher.plan as PlanSlug
  const planInfo = PLANS[currentPlan]
  const isFreePlan = currentPlan === 'free'
  const isTrialing = teacher.trial_ends_at
    ? new Date(teacher.trial_ends_at as string) > new Date()
    : false

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

  // Build feature/limit rows
  type FeatureRow = {
    label: string
    liveValue: string
    snapshotValue: string | null
    enabledLive: boolean | null
    enabledSnapshot: boolean | null
    isLimit: boolean
    deltaLabel: string | null
  }

  const rows: FeatureRow[] = []

  for (const feature of FEATURE_REGISTRY) {
    const key = feature.key as FeatureKey
    const live = planDetails?.features[key] ?? false
    const snap = snapshot ? snapshot.features[key] : undefined
    const snapshotValue = snap === undefined ? null : snap ? 'Included' : 'Locked'
    const deltaLabel =
      snap !== undefined && snap !== live ? (snap ? 'Was: included' : 'Was: locked') : null
    rows.push({
      label: feature.displayName,
      liveValue: live ? 'Included' : 'Locked',
      snapshotValue,
      enabledLive: live,
      enabledSnapshot: snap === undefined ? null : snap,
      isLimit: false,
      deltaLabel,
    })
  }

  for (const limit of LIMIT_DISPLAY) {
    const liveRaw = planDetails?.limits[limit.key]
    const snapRaw = snapshot ? snapshot.limits[limit.key] : undefined
    const liveStr = formatLimit(liveRaw, limit.suffix)
    const snapStr = snapRaw === undefined ? null : formatLimit(snapRaw, limit.suffix)
    const deltaLabel =
      snapRaw !== undefined && liveRaw !== undefined && snapRaw !== liveRaw
        ? `Was: ${snapStr}`
        : null
    rows.push({
      label: limit.label,
      liveValue: liveStr,
      snapshotValue: snapStr,
      enabledLive: null,
      enabledSnapshot: null,
      isLimit: true,
      deltaLabel,
    })
  }

  const isGrandfathered = !!snapshot?.isGrandfathered
  const showWasColumn = isGrandfathered && rows.some((r) => r.deltaLabel)

  // What's-different list (snapshot has more than live)
  const differences = isGrandfathered
    ? rows.filter((r) => r.deltaLabel).map((r) => ({
        label: r.label,
        was: r.snapshotValue ?? '—',
        now: r.liveValue,
      }))
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan & Subscription"
        description="Manage your subscription plan and view usage"
      />

      {/* Current Plan Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{planInfo?.name ?? currentPlan} Plan</h2>
              {isGrandfathered && (
                <Badge variant="outline" title={
                  snapshot?.capturedAt
                    ? `On legacy terms captured ${formatPKT(snapshot.capturedAt, 'date')}.`
                    : 'On legacy terms.'
                }>
                  Grandfathered
                </Badge>
              )}
            </div>
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

      {/* Features + Limits table */}
      <Card className="p-6">
        <h3 className="mb-4 text-base font-semibold text-foreground">Features & limits</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Feature / Limit</th>
                <th className="pb-2 pr-4 font-medium">Live plan</th>
                <th className="pb-2 pr-4 font-medium">Your effective</th>
                {showWasColumn && <th className="pb-2 font-medium">Was</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const effectiveValue = row.snapshotValue ?? row.liveValue
                const effectiveEnabled =
                  row.enabledSnapshot !== null
                    ? row.enabledSnapshot
                    : row.enabledLive
                return (
                  <tr key={row.label} className="border-b border-border/40">
                    <td className="py-2 pr-4 text-foreground">{row.label}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      <Cell value={row.liveValue} enabled={row.enabledLive} isLimit={row.isLimit} />
                    </td>
                    <td className="py-2 pr-4 text-foreground">
                      <Cell value={effectiveValue} enabled={effectiveEnabled} isLimit={row.isLimit} />
                    </td>
                    {showWasColumn && (
                      <td className="py-2 text-xs text-muted-foreground">
                        {row.deltaLabel ?? ''}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* What's different — collapsible-style list */}
      {isGrandfathered && differences.length > 0 && (
        <Card className="p-6">
          <h3 className="mb-3 text-base font-semibold text-foreground">
            What&apos;s different from the current plan?
          </h3>
          <ul className="space-y-2 text-sm">
            {differences.map((d) => (
              <li key={d.label} className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-foreground">{d.label}</span>
                <span className="text-muted-foreground">
                  Was <span className="font-medium text-foreground">{d.was}</span> · Now {d.now}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Pointer to billing history */}
      <p className="text-sm text-muted-foreground">
        Looking for receipts and payouts?{' '}
        <Link href={ROUTES.TEACHER.settings.billing} className="text-primary hover:underline">
          View billing history &rarr;
        </Link>
      </p>
    </div>
  )
}

function Cell({
  value,
  enabled,
  isLimit,
}: {
  value: string
  enabled: boolean | null
  isLimit: boolean
}) {
  if (isLimit) return <span>{value}</span>
  return (
    <span className="inline-flex items-center gap-2">
      <PlanFeatureIcon enabled={enabled === true} />
      <span className={enabled ? 'text-foreground' : 'text-muted-foreground'}>{value}</span>
    </span>
  )
}
