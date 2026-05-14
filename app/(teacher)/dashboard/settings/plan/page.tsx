/**
 * app/(teacher)/dashboard/settings/plan/page.tsx — Teacher plan management page
 *
 * Server Component. Shows:
 * - Current plan name, price, expiry/trial status
 * - Feature/limit table with check/lock icons (effective values — snapshot
 *   silently wins over live plan when one exists)
 * - Usage bars for plan limits
 * - Upgrade/renew CTA
 *
 * Note: grandfathering is intentionally hidden from the teacher (single
 * "Your plan" column). The teacher_plan_snapshot mechanism still operates at
 * the data layer for getLimit() / canUseFeature() — it just isn't surfaced
 * here. See lib/db/subscriptions.ts::createPlanSnapshot.
 *
 * Subscription history lives at /dashboard/settings/billing (Lane E2 split).
 */

import type { Metadata } from 'next'
import { Link } from 'next-view-transitions'
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

  // Build feature/limit rows. Values are "effective" — snapshot wins over live
  // when one exists, mirroring runtime behavior of getLimit() / canUseFeature().
  // Snapshot is purely an internal mechanism; teachers see one set of terms.
  type FeatureRow = {
    label: string
    value: string
    enabled: boolean | null
    isLimit: boolean
  }

  const rows: FeatureRow[] = []

  for (const feature of FEATURE_REGISTRY) {
    const key = feature.key as FeatureKey
    const live = planDetails?.features[key] ?? false
    const snap = snapshot ? snapshot.features[key] : undefined
    const effective = snap !== undefined ? snap : live
    rows.push({
      label: feature.displayName,
      value: effective ? 'Included' : 'Locked',
      enabled: effective,
      isLimit: false,
    })
  }

  for (const limit of LIMIT_DISPLAY) {
    const liveRaw = planDetails?.limits[limit.key]
    const snapRaw = snapshot ? snapshot.limits[limit.key] : undefined
    const effectiveRaw = snapRaw !== undefined ? snapRaw : liveRaw
    rows.push({
      label: limit.label,
      value: formatLimit(effectiveRaw, limit.suffix),
      enabled: null,
      isLimit: true,
    })
  }

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

      {/* Features + Limits table */}
      <Card className="p-6">
        <h3 className="mb-4 text-base font-semibold text-foreground">Features & limits</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Feature / Limit</th>
                <th className="pb-2 font-medium">Your plan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-border/40">
                  <td className="py-2 pr-4 text-foreground">{row.label}</td>
                  <td className="py-2 text-foreground">
                    <Cell value={row.value} enabled={row.enabled} isLimit={row.isLimit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

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
