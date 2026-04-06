/**
 * app/(teacher)/dashboard/settings/page.tsx — Teacher profile settings
 *
 * Server Component. Displays editable profile form.
 */

import type { Metadata } from 'next'
import { requireTeacher } from '@/lib/auth/guards'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProfileSettingsForm } from '@/components/teacher/ProfileSettingsForm'

export const metadata: Metadata = {
  title: 'Settings \u2014 Skool Rooms',
}

export default async function TeacherSettingsPage() {
  const teacher = await requireTeacher()

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your profile and account settings."
      />

      <ProfileSettingsForm
        initialData={{
          name: teacher.name,
          bio: teacher.bio ?? '',
          city: teacher.city ?? '',
          profilePhotoUrl: teacher.profile_photo_url ?? '',
          isPubliclyListed: teacher.is_publicly_listed,
          subjectTags: (teacher.subject_tags ?? []).join(', '),
          teachingLevels: (teacher.teaching_levels ?? []).join(', '),
        }}
      />
    </>
  )
}
