'use client'

import { Link } from 'next-view-transitions'
import type { ActivityLogItem } from '@/lib/db/admin'
import { formatPKT } from '@/lib/time/pkt'
import { ROUTES } from '@/constants/routes'

type ActivityLogTableProps = {
  rows: ActivityLogItem[]
  teacherMap: Record<string, { name: string; email: string }>
  /** @deprecated Cursor pagination on the page now handles paging — these are ignored. */
  page?: number
  /** @deprecated */
  totalPages?: number
  /** @deprecated */
  totalCount?: number
  /** @deprecated */
  baseHref?: string
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  change_plan: 'Change Plan',
  extend_expiry: 'Extend Expiry',
  extend_trial: 'Extend Trial',
  suspend_teacher: 'Suspend Teacher',
  reactivate_teacher: 'Reactivate Teacher',
  update_platform_settings: 'Update Settings',
  bulk_email_sent: 'Bulk Email Sent',
  view_as_start: 'View As Start',
  view_as_end: 'View As End',
  password_reset_generated: 'Password Reset',
  wipe_test_account: 'Wipe Test Account',
  create_plan: 'Create Plan',
  update_plan: 'Update Plan',
  archive_plan: 'Archive Plan',
  delete_plan: 'Delete Plan',
  approve_subscription: 'Approve Subscription',
  reject_subscription: 'Reject Subscription',
}

function formatActionType(raw: string): string {
  return ACTION_TYPE_LABELS[raw] ?? raw.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function ActivityLogTable({
  rows,
  teacherMap,
}: ActivityLogTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-muted p-8 text-center text-sm text-muted-foreground">
        No activity log entries found.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {rows.map((row) => (
          <ActivityCard key={row.id} row={row} teacherMap={teacherMap} />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl bg-card ring-1 ring-foreground/5">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-foreground/[0.05]">
              <Th>Timestamp (PKT)</Th>
              <Th>Action</Th>
              <Th>Performed by</Th>
              <Th>Teacher</Th>
              <Th>Details</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const teacher = row.teacher_id ? teacherMap[row.teacher_id] : null
              return (
                <tr key={row.id} className="border-b border-foreground/[0.03] last:border-0 align-top">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatPKT(row.created_at, 'datetime')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                      {formatActionType(row.action_type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{row.performed_by}</td>
                  <td className="px-4 py-3">
                    {teacher && row.teacher_id ? (
                      <Link
                        href={ROUTES.ADMIN.teacherDetail(row.teacher_id)}
                        className="text-primary underline-offset-4 hover:underline text-xs"
                      >
                        {teacher.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {row.metadata ? (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          View details
                        </summary>
                        <pre className="mt-1 overflow-x-auto rounded bg-muted px-2 py-1.5 text-[10px] text-foreground">
                          {JSON.stringify(row.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

    </div>
  )
}

function ActivityCard({
  row,
  teacherMap,
}: {
  row: ActivityLogItem
  teacherMap: Record<string, { name: string; email: string }>
}) {
  const teacher = row.teacher_id ? teacherMap[row.teacher_id] : null

  return (
    <div className="rounded-2xl bg-card ring-1 ring-foreground/5 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
          {formatActionType(row.action_type)}
        </span>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatPKT(row.created_at, 'datetime')}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">by {row.performed_by}</p>
      {teacher && row.teacher_id && (
        <Link
          href={ROUTES.ADMIN.teacherDetail(row.teacher_id)}
          className="text-xs text-primary underline-offset-4 hover:underline"
        >
          {teacher.name}
        </Link>
      )}
      {row.metadata && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">View details</summary>
          <pre className="mt-1 overflow-x-auto rounded bg-muted px-2 py-1.5 text-[10px] text-foreground">
            {JSON.stringify(row.metadata, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
      {children}
    </th>
  )
}
