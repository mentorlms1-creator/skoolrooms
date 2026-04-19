import { requireAdmin } from '@/lib/auth/guards'
import { getAllPlans, getGrandfatheredTeachers, getSubscriberCountByPlan } from '@/lib/db/admin-plans'
import { ROUTES } from '@/constants/routes'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function PlansPage() {
  await requireAdmin()

  const [plans, grandfathered] = await Promise.all([
    getAllPlans(),
    getGrandfatheredTeachers(),
  ])

  // Get subscriber counts
  const subscriberCounts = await Promise.all(
    plans.map((p) => getSubscriberCountByPlan(p.id))
  )

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Plans</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage subscription plans, limits, and features.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {grandfathered.length > 0 && (
            <Link
              href="/admin/plans/grandfathered"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              View grandfathered teachers ({grandfathered.length})
            </Link>
          )}
          <Link href="/admin/plans/new">
            <Button variant="primary" size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Plan
            </Button>
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        {plans.map((plan, i) => (
          <Card
            key={plan.id}
            className="border-none shadow-sm ring-1 ring-foreground/5 rounded-2xl bg-card"
          >
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                  {plan.display_order}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{plan.name}</span>
                    <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                      {plan.slug}
                    </span>
                    {!plan.is_active && <StatusBadge status="archived" size="sm" />}
                    {plan.is_featured && (
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Featured
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    ₨{plan.price_pkr.toLocaleString()}/mo · {subscriberCounts[i]} teachers ·{' '}
                    {plan.transaction_cut_percent}% cut
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {plan.max_courses}c / {plan.max_students}s / {plan.max_cohorts_active} cohorts
                </span>
                <Link href={ROUTES.ADMIN.planDetail(plan.id)}>
                  <Button variant="secondary" size="sm" className="rounded-lg">
                    Edit
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}

        {plans.length === 0 && (
          <div className="rounded-2xl bg-muted p-8 text-center text-sm text-muted-foreground">
            No plans configured yet.
          </div>
        )}
      </div>
    </div>
  )
}
