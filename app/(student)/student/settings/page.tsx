/**
 * app/(student)/student/settings/page.tsx — Student profile settings
 *
 * Server Component. Displays student profile info (read-only for now).
 * Edit functionality will be added in a later week.
 */

import { requireStudent } from '@/lib/auth/guards'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { formatPKT } from '@/lib/time/pkt'

export default async function StudentSettingsPage() {
  const student = await requireStudent()

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile information"
      />

      <Card className="max-w-2xl p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink">
          Profile Details
        </h2>

        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-muted">Full Name</dt>
            <dd className="mt-1 text-ink">{student.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted">Email</dt>
            <dd className="mt-1 text-ink">{student.email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted">Phone</dt>
            <dd className="mt-1 text-ink">{student.phone || 'Not provided'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted">Member Since</dt>
            <dd className="mt-1 text-ink">
              {formatPKT(student.created_at, 'date')}
            </dd>
          </div>
        </dl>

        <p className="mt-6 text-sm text-muted">
          To update your profile information, please contact your teacher.
        </p>
      </Card>
    </>
  )
}
