import { requireAdmin } from '@/lib/auth/guards'
import { getActivityLog, getActivityLogCount } from '@/lib/db/admin'
import { createAdminClient } from '@/supabase/server'
import { ActivityLogTable } from '@/components/admin/ActivityLogTable'
import Link from 'next/link'

const PAGE_SIZE = 50

const KNOWN_ACTION_TYPES = [
  'change_plan',
  'extend_expiry',
  'extend_trial',
  'suspend_teacher',
  'reactivate_teacher',
  'update_platform_settings',
  'bulk_email_sent',
  'view_as_start',
  'view_as_end',
  'password_reset_generated',
  'wipe_test_account',
  'create_plan',
  'update_plan',
  'archive_plan',
  'delete_plan',
  'approve_subscription',
  'reject_subscription',
]

type SearchParams = {
  teacherId?: string
  actionType?: string
  page?: string
}

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireAdmin()

  const { teacherId, actionType, page: pageStr } = await searchParams
  const page = Math.max(1, Number(pageStr ?? '1'))
  const offset = (page - 1) * PAGE_SIZE

  const filters = {
    teacherId: teacherId || undefined,
    actionType: actionType || undefined,
  }

  const [rows, totalCount] = await Promise.all([
    getActivityLog({ ...filters, limit: PAGE_SIZE, offset }),
    getActivityLogCount(filters),
  ])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Resolve teacher names for rows that have a teacher_id
  const supabase = createAdminClient()
  const teacherIds = [...new Set(rows.filter((r) => r.teacher_id).map((r) => r.teacher_id!))]
  const teacherMap: Record<string, { name: string; email: string }> = {}

  if (teacherIds.length > 0) {
    const { data: teachers } = await supabase
      .from('teachers')
      .select('id, name, email')
      .in('id', teacherIds)

    if (teachers) {
      for (const t of teachers) {
        teacherMap[t.id as string] = { name: t.name as string, email: t.email as string }
      }
    }
  }

  // Build current filter URL base (without page param)
  const filterParams = new URLSearchParams()
  if (teacherId) filterParams.set('teacherId', teacherId)
  if (actionType) filterParams.set('actionType', actionType)
  const baseHref = `/admin/activity${filterParams.toString() ? `?${filterParams}` : ''}`

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All admin actions across the platform, newest first.
        </p>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3">
        {teacherId && <input type="hidden" name="teacherId" value={teacherId} />}
        <select
          name="actionType"
          defaultValue={actionType ?? ''}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All action types</option>
          {KNOWN_ACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filter
        </button>
        {(teacherId || actionType) && (
          <Link
            href="/admin/activity"
            className="h-9 flex items-center rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </Link>
        )}
        {teacherId && (
          <span className="h-9 flex items-center rounded-lg bg-muted px-3 text-sm text-muted-foreground">
            Filtered to teacher: {teacherMap[teacherId]?.name ?? teacherId}
          </span>
        )}
      </form>

      <ActivityLogTable
        rows={rows}
        teacherMap={teacherMap}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        baseHref={baseHref}
      />
    </div>
  )
}
