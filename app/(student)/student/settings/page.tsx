/**
 * app/(student)/student/settings/page.tsx — Student profile settings
 *
 * Server Component with client form for editing profile.
 */

import type { Metadata } from 'next'
import { requireStudent } from '@/lib/auth/guards'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { formatPKT } from '@/lib/time/pkt'
import { StudentSettingsForm } from './form'

export const metadata: Metadata = {
  title: 'Settings \u2014 Lumscribe Student',
}

export default async function StudentSettingsPage() {
  const student = await requireStudent()

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your profile information"
      />

      <Card className="max-w-2xl p-6">
        <StudentSettingsForm
          defaultName={student.name as string}
          defaultPhone={student.phone as string}
          email={student.email as string}
          memberSince={formatPKT(student.created_at as string, 'date')}
        />
      </Card>
    </>
  )
}
