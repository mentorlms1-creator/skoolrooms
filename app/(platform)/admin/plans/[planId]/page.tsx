import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import { getPlanWithFeatures, getSubscriberCountByPlan } from '@/lib/db/admin-plans'
import { ROUTES } from '@/constants/routes'
import { PageHeader } from '@/components/ui/PageHeader'
import { PlanEditForm } from './PlanEditForm'

export default async function PlanEditPage({
  params,
}: {
  params: Promise<{ planId: string }>
}) {
  await requireAdmin()

  const { planId } = await params
  const result = await getPlanWithFeatures(planId)

  if (!result) notFound()

  const subscriberCount = await getSubscriberCountByPlan(planId)

  return (
    <>
      <PageHeader
        title={`Edit Plan: ${result.plan.name}`}
        description={`/${result.plan.slug} · ${subscriberCount} subscribers`}
        backHref={ROUTES.ADMIN.plans}
      />

      <div className="p-0 sm:p-4">
        <PlanEditForm
          plan={result.plan}
          features={result.features}
          featureRegistry={result.featureRegistry}
          subscriberCount={subscriberCount}
        />
      </div>
    </>
  )
}
