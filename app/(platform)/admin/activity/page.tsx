import { Link } from 'next-view-transitions'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/guards'
import { getActivityLogCursor } from '@/lib/db/admin'
import { createAdminClient } from '@/supabase/server'
import { ActivityLogTable } from '@/components/admin/ActivityLogTable'
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination/limits'

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
  cursor?: string
}

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireAdmin()

  const { teacherId, actionType, cursor } = await searchParams

  const page = await getActivityLogCursor({
    cursor: cursor ?? null,
    limit: DEFAULT_PAGE_SIZE,
    teacherId: teacherId || null,
    actionType: actionType || null,
  })

  // Resolve teacher names for the visible page only.
  const supabase = createAdminClient()
  const teacherIds = [...new Set(page.rows.filter((r) => r.teacher_id).map((r) => r.teacher_id!))]
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

  const filterParams = new URLSearchParams()
  if (teacherId) filterParams.set('teacherId', teacherId)
  if (actionType) filterParams.set('actionType', actionType)
  const filterQs = filterParams.toString()
  const baseHref = `/admin/activity${filterQs ? `?${filterQs}` : ''}`

  const nextHref = page.nextCursor
    ? `/admin/activity?${new URLSearchParams({
        ...(teacherId ? { teacherId } : {}),
        ...(actionType ? { actionType } : {}),
        cursor: page.nextCursor,
      }).toString()}`
    : null
  const prevHref = cursor ? baseHref : null

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All admin actions across the platform, newest first.
        </p>
      </div>

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

      <ActivityLogTable rows={page.rows} teacherMap={teacherMap} />

      <div className="flex items-center justify-between gap-3 pt-2">
        <CursorLink href={prevHref} disabled={!prevHref} direction="prev">
          Newer
        </CursorLink>
        <CursorLink href={nextHref} disabled={!nextHref} direction="next">
          Older
        </CursorLink>
      </div>
    </div>
  )
}

function CursorLink({
  href,
  disabled,
  direction,
  children,
}: {
  href: string | null
  disabled: boolean
  direction: 'prev' | 'next'
  children: React.ReactNode
}) {
  if (disabled || !href) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-muted-foreground/40">
        {direction === 'prev' && <ChevronLeft className="h-4 w-4" />}
        {children}
        {direction === 'next' && <ChevronRight className="h-4 w-4" />}
      </span>
    )
  }
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium hover:bg-muted/80"
    >
      {direction === 'prev' && <ChevronLeft className="h-4 w-4" />}
      {children}
      {direction === 'next' && <ChevronRight className="h-4 w-4" />}
    </Link>
  )
}
