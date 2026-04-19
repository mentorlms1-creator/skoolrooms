import { requireAdmin } from '@/lib/auth/guards'
import { getGrandfatheredTeachers } from '@/lib/db/admin-plans'
import { PageHeader } from '@/components/ui/PageHeader'
import { GrandfatheredTable } from '@/components/admin/GrandfatheredTable'
import { ROUTES } from '@/constants/routes'

export default async function GrandfatheredPage() {
  await requireAdmin()

  const rows = await getGrandfatheredTeachers()

  return (
    <>
      <PageHeader
        title="Grandfathered Teachers"
        description={`${rows.length} teacher${rows.length !== 1 ? 's' : ''} with snapshot limits that exceed current plan limits`}
        backHref={ROUTES.ADMIN.plans}
      />

      <div className="mt-6">
        <GrandfatheredTable rows={rows} />
      </div>
    </>
  )
}
