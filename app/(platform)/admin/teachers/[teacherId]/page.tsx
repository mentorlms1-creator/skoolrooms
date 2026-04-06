/**
 * app/(platform)/admin/teachers/[teacherId]/page.tsx — Teacher detail page
 *
 * Server Component. Shows full teacher profile, plan info, subscription history,
 * activity log. Admin can suspend/reactivate, change plan, extend expiry/trial.
 */

import { notFound } from 'next/navigation'
import { getTeacherDetail } from '@/lib/db/admin'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left column — Profile info */}
        <div className="space-y-5 lg:col-span-2">
          {/* Profile Card */}
          <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
            <CardHeader className="px-8 pt-8 pb-4">
              <CardTitle className="text-xl font-bold">Profile</CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoGroup label="Subdomain" value={teacher.subdomain} />
                <InfoGroup label="City" value={teacher.city ?? 'Not set'} />
                <InfoGroup label="Bio" value={teacher.bio ?? 'Not set'} />
                <InfoGroup
                  label="Subject Tags"
                  value={teacher.subject_tags.length > 0 ? teacher.subject_tags.join(', ') : 'None'}
                />
                <InfoGroup
                  label="Teaching Levels"
                  value={teacher.teaching_levels.length > 0 ? teacher.teaching_levels.join(', ') : 'None'}
                />
                <InfoGroup
                  label="Publicly Listed"
                  value={teacher.is_publicly_listed ? 'Yes' : 'No'}
                />
                <InfoGroup
                  label="Onboarding Complete"
                  value={teacher.onboarding_completed ? 'Yes' : 'No'}
                />
                <InfoGroup label="Students" value={String(teacher.student_count)} />
                <InfoGroup
                  label="Joined"
                  value={formatPKT(teacher.created_at, 'datetime')}
                />
                <InfoGroup
                  label="Last Updated"
                  value={formatPKT(teacher.updated_at, 'datetime')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Subscription History */}
          <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
            <CardHeader className="px-8 pt-8 pb-4">
              <CardTitle className="text-xl font-bold">Subscription History</CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              {teacher.subscription_history.length === 0 ? (
                <div className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-6 text-center">
                  <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
                </div>
              ) : (
                <>
                  {/* Mobile card view */}
                  <div className="md:hidden flex flex-col gap-3">
                    {teacher.subscription_history.map((sub) => (
                      <div
                        key={sub.id}
                        className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-4 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground capitalize">{sub.plan}</span>
                          <StatusBadge status={sub.status} size="sm" />
                        </div>
                        <p className="mt-2 font-semibold text-foreground">PKR {sub.amount_pkr.toLocaleString()}</p>
                        <p className="mt-1 text-muted-foreground capitalize">{sub.payment_method}</p>
                        <p className="mt-1 text-muted-foreground">
                          {formatPKT(sub.period_start, 'date')} - {formatPKT(sub.period_end, 'date')}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground/60">{formatPKT(sub.created_at, 'date')}</p>
                      </div>
                    ))}
                  </div>
                  {/* Desktop table view */}
                  <div className="hidden md:block overflow-x-auto">
                    <div className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-foreground/[0.05]">
                            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Plan</th>
                            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Amount</th>
                            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Method</th>
                            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Status</th>
                            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Period</th>
                            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teacher.subscription_history.map((sub) => (
                            <tr key={sub.id} className="border-b border-foreground/[0.03] last:border-0">
                              <td className="px-4 py-3 capitalize font-semibold text-foreground">{sub.plan}</td>
                              <td className="px-4 py-3 font-semibold text-foreground">PKR {sub.amount_pkr.toLocaleString()}</td>
                              <td className="px-4 py-3 text-foreground capitalize">{sub.payment_method}</td>
                              <td className="px-4 py-3">
                                <StatusBadge status={sub.status} size="sm" />
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {formatPKT(sub.period_start, 'date')} - {formatPKT(sub.period_end, 'date')}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {formatPKT(sub.created_at, 'date')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Activity Log */}
          <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
            <CardHeader className="px-8 pt-8 pb-4">
              <CardTitle className="text-xl font-bold">Activity Log</CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              {teacher.activity_log.length === 0 ? (
                <div className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-6 text-center">
                  <p className="text-sm text-muted-foreground">No admin activity recorded.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {teacher.activity_log.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl bg-container ring-1 ring-foreground/[0.03] p-4"
                    >
                      <p className="text-[15px] font-bold text-foreground">
                        {formatActionType(entry.action_type)}
                      </p>
                      <p className="mt-1 text-xs font-medium text-muted-foreground/60">
                        by {entry.performed_by} — {formatPKT(entry.created_at, 'datetime')}
                      </p>
                      {entry.metadata && (
                        <p className="mt-2 max-w-xs break-all truncate text-xs text-muted-foreground/50">
                          {JSON.stringify(entry.metadata)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — Plan + Actions */}
        <div className="space-y-5">
          {/* Plan Info */}
          <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
            <CardHeader className="px-8 pt-8 pb-4">
              <CardTitle className="text-xl font-bold">Plan</CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="space-y-3">
                <InfoGroup label="Current Plan" value={teacher.plan} />
                <InfoGroup
                  label="Status"
                  value={teacher.is_suspended ? 'Suspended' : 'Active'}
                />
                {teacher.suspended_at && (
                  <InfoGroup
                    label="Suspended At"
                    value={formatPKT(teacher.suspended_at, 'datetime')}
                  />
                )}
                <InfoGroup
                  label="Plan Expires"
                  value={teacher.plan_expires_at ? formatPKT(teacher.plan_expires_at, 'datetime') : 'Never (free)'}
                />
                <InfoGroup
                  label="Grace Until"
                  value={teacher.grace_until ? formatPKT(teacher.grace_until, 'datetime') : 'N/A'}
                />
                <InfoGroup
                  label="Trial Ends"
                  value={teacher.trial_ends_at ? formatPKT(teacher.trial_ends_at, 'datetime') : 'N/A'}
                />
              </div>
            </CardContent>
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

function InfoGroup({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
        {label}
      </dt>
      <dd className="mt-1 text-[15px] font-bold text-foreground capitalize">{value}</dd>
    </div>
  )
}

function formatActionType(actionType: string): string {
  return actionType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
