/**
 * app/(student)/student/settings/page.tsx — Student profile settings
 *
 * Server Component with client form for editing profile.
 */

import type { Metadata } from 'next'
import { Settings } from 'lucide-react'
import { requireStudent } from '@/lib/auth/guards'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { formatPKT } from '@/lib/time/pkt'
import { StudentSettingsForm } from './form'

export const metadata: Metadata = {
  title: 'Settings \u2014 Skool Rooms Student',
}

export default async function StudentSettingsPage() {
  const student = await requireStudent()

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your profile information"
      />

      <Card className="max-w-2xl rounded-[2rem] border-none shadow-sm ring-1 ring-foreground/5 bg-card overflow-hidden">
        <CardContent className="px-8 pt-8 pb-8">
          <div className="mb-6 flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Profile</h2>
          </div>
          <StudentSettingsForm
            defaultName={student.name as string}
            defaultPhone={student.phone as string}
            email={student.email as string}
            memberSince={formatPKT(student.created_at as string, 'date')}
            guardianDefaults={{
              parent_name: (student.parent_name as string | null) ?? null,
              parent_phone: (student.parent_phone as string | null) ?? null,
              parent_email: (student.parent_email as string | null) ?? null,
            }}
          />
        </CardContent>
      </Card>
    </>
  )
}
