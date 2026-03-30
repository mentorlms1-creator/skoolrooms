/**
 * app/(teacher)/dashboard/settings/notifications/page.tsx — Notification preferences
 *
 * Server Component. Displays per-type notification toggles.
 */

import { requireTeacher } from '@/lib/auth/guards'
import { PageHeader } from '@/components/ui/PageHeader'
import { NotificationSettingsForm } from '@/components/teacher/NotificationSettingsForm'
import { ROUTES } from '@/constants/routes'

export default async function TeacherNotificationSettingsPage() {
  const teacher = await requireTeacher()

  const preferences = (teacher.notification_preferences_json ?? {}) as Record<string, boolean>

  return (
    <>
      <PageHeader
        title="Notification Preferences"
        description="Choose which email notifications you receive."
        backHref={ROUTES.TEACHER.settings.root}
      />

      <NotificationSettingsForm preferences={preferences} />
    </>
  )
}
