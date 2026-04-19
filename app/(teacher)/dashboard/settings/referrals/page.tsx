/**
 * app/(teacher)/dashboard/settings/referrals/page.tsx — Teacher referral program
 * Server Component.
 */

import type { Metadata } from 'next'
import { requireTeacher } from '@/lib/auth/guards'
import { getTeacherReferralCode } from '@/lib/db/referrals'
import { getReferralsByReferrer } from '@/lib/db/referrals'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatPKT } from '@/lib/time/pkt'
import { platformUrl } from '@/lib/platform/domain'
import { ROUTES } from '@/constants/routes'
import { GenerateReferralButton } from './GenerateReferralButton'
import { CopyButton } from './CopyButton'

export const metadata: Metadata = {
  title: 'Referrals \u2014 Skool Rooms',
}

export default async function ReferralsPage() {
  const teacher = await requireTeacher()

  const [referralCode, referrals] = await Promise.all([
    getTeacherReferralCode(teacher.id),
    getReferralsByReferrer(teacher.id),
  ])

  const referralUrl = referralCode ? platformUrl(`/signup?ref=${referralCode}`) : null

  return (
    <>
      <PageHeader
        title="Referrals"
        description="Invite other teachers and earn 30 bonus days on your plan."
        backHref={ROUTES.TEACHER.settings.root}
      />

      {/* Referral link card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Your Referral Link</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            When another teacher signs up using your referral link and subscribes to a paid
            plan, you both get <strong>30 bonus days</strong> added to your subscription.
          </p>

          {referralUrl ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <code className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-mono text-foreground break-all">
                {referralUrl}
              </code>
              <CopyButton text={referralUrl} />
            </div>
          ) : (

            <GenerateReferralButton />
          )}
        </CardContent>
      </Card>

      {/* Referrals table */}
      <Card>
        <CardHeader>
          <CardTitle>Referral History</CardTitle>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No referrals yet. Share your referral link to get started!
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4">Teacher</th>
                    <th className="pb-3 pr-4">Joined</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {referrals.map((r) => (
                    <tr key={r.id}>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-foreground">
                          {r.referred?.name ?? 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.referred?.email ?? ''}
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {formatPKT(r.created_at, 'date')}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={r.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

