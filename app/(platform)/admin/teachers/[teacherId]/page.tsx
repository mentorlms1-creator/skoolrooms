/**
 * app/(platform)/admin/teachers/[teacherId]/page.tsx — Teacher detail page
 *
 * Server Component. Shows full teacher profile, plan info, subscription history,
 * activity log. Admin can suspend/reactivate, change plan, extend expiry/trial.
 */

import { notFound } from 'next/navigation'
import { getTeacherDetail } from '@/lib/db/admin'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ROUTES } from '@/constants/routes'
import { formatPKT } from '@/lib/time/pkt'
import { TeacherDetailActions } from '@/components/admin/TeacherDetailActions'

export default async function AdminTeacherDetailPage(
  props: { params: Promise<{ teacherId: string }> }
) {
  const params = await props.params
  const teacher = await getTeacherDetail(params.teacherId)

  if (!teacher) {
    notFound()
  }

  return (
    <>
      <PageHeader
        title={teacher.name}
        description={teacher.email}
        backHref={ROUTES.ADMIN.teachers}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — Profile info */}
        <div className="space-y-6 lg:col-span-2">
          {/* Profile Card */}
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-ink">Profile</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <InfoItem label="Subdomain" value={teacher.subdomain} />
              <InfoItem label="City" value={teacher.city ?? 'Not set'} />
              <InfoItem label="Bio" value={teacher.bio ?? 'Not set'} />
              <InfoItem
                label="Subject Tags"
                value={teacher.subject_tags.length > 0 ? teacher.subject_tags.join(', ') : 'None'}
              />
              <InfoItem
                label="Teaching Levels"
                value={teacher.teaching_levels.length > 0 ? teacher.teaching_levels.join(', ') : 'None'}
              />
              <InfoItem
                label="Publicly Listed"
                value={teacher.is_publicly_listed ? 'Yes' : 'No'}
              />
              <InfoItem
                label="Onboarding Complete"
                value={teacher.onboarding_completed ? 'Yes' : 'No'}
              />
              <InfoItem label="Students" value={String(teacher.student_count)} />
              <InfoItem
                label="Joined"
                value={formatPKT(teacher.created_at, 'datetime')}
              />
              <InfoItem
                label="Last Updated"
                value={formatPKT(teacher.updated_at, 'datetime')}
              />
            </dl>
          </Card>

          {/* Subscription History */}
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-ink">Subscription History</h2>
            {teacher.subscription_history.length === 0 ? (
              <p className="text-sm text-muted">No subscriptions yet.</p>
            ) : (
              <>
              {/* Mobile card view */}
              <div className="md:hidden flex flex-col gap-3">
                {teacher.subscription_history.map((sub) => (
                  <div key={sub.id} className="rounded-md border border-border p-3 sm:p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-ink capitalize">{sub.plan}</span>
                      <StatusBadge status={sub.status} size="sm" />
                    </div>
                    <p className="mt-1 text-ink">PKR {sub.amount_pkr.toLocaleString()}</p>
                    <p className="mt-1 text-muted capitalize">{sub.payment_method}</p>
                    <p className="mt-1 text-muted">
                      {formatPKT(sub.period_start, 'date')} - {formatPKT(sub.period_end, 'date')}
                    </p>
                    <p className="mt-1 text-muted">{formatPKT(sub.created_at, 'date')}</p>
                  </div>
                ))}
              </div>
              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 font-medium text-muted">Plan</th>
                      <th className="px-3 py-2 font-medium text-muted">Amount</th>
                      <th className="px-3 py-2 font-medium text-muted">Method</th>
                      <th className="px-3 py-2 font-medium text-muted">Status</th>
                      <th className="px-3 py-2 font-medium text-muted">Period</th>
                      <th className="px-3 py-2 font-medium text-muted">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacher.subscription_history.map((sub) => (
                      <tr key={sub.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 capitalize text-ink">{sub.plan}</td>
                        <td className="px-3 py-2 text-ink">PKR {sub.amount_pkr.toLocaleString()}</td>
                        <td className="px-3 py-2 text-ink capitalize">{sub.payment_method}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={sub.status} size="sm" />
                        </td>
                        <td className="px-3 py-2 text-muted">
                          {formatPKT(sub.period_start, 'date')} - {formatPKT(sub.period_end, 'date')}
                        </td>
                        <td className="px-3 py-2 text-muted">
                          {formatPKT(sub.created_at, 'date')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </Card>

          {/* Activity Log */}
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-ink">Activity Log</h2>
            {teacher.activity_log.length === 0 ? (
              <p className="text-sm text-muted">No admin activity recorded.</p>
            ) : (
              <div className="space-y-3">
                {teacher.activity_log.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 border-b border-border pb-3 last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink">
                        {formatActionType(entry.action_type)}
                      </p>
                      <p className="text-xs text-muted">
                        by {entry.performed_by} — {formatPKT(entry.created_at, 'datetime')}
                      </p>
                      {entry.metadata && (
                        <p className="mt-1 max-w-xs break-all truncate text-xs text-muted">
                          {JSON.stringify(entry.metadata)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right column — Plan + Actions */}
        <div className="space-y-6">
          {/* Plan Info */}
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-ink">Plan</h2>
            <dl className="space-y-3">
              <InfoItem label="Current Plan" value={teacher.plan} />
              <InfoItem
                label="Status"
                value={teacher.is_suspended ? 'Suspended' : 'Active'}
              />
              {teacher.suspended_at && (
                <InfoItem
                  label="Suspended At"
                  value={formatPKT(teacher.suspended_at, 'datetime')}
                />
              )}
              <InfoItem
                label="Plan Expires"
                value={teacher.plan_expires_at ? formatPKT(teacher.plan_expires_at, 'datetime') : 'Never (free)'}
              />
              <InfoItem
                label="Grace Until"
                value={teacher.grace_until ? formatPKT(teacher.grace_until, 'datetime') : 'N/A'}
              />
              <InfoItem
                label="Trial Ends"
                value={teacher.trial_ends_at ? formatPKT(teacher.trial_ends_at, 'datetime') : 'N/A'}
              />
            </dl>
          </Card>

          {/* Admin Actions */}
          <TeacherDetailActions
            teacherId={teacher.id}
            currentPlan={teacher.plan}
            isSuspended={teacher.is_suspended}
          />
        </div>
      </div>
    </>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink capitalize">{value}</dd>
    </div>
  )
}

function formatActionType(actionType: string): string {
  return actionType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
