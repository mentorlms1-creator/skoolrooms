/**
 * app/(platform)/admin/settings/page.tsx — Platform settings
 *
 * Server Component. Displays platform settings for admin to toggle/edit.
 */

import type { Metadata } from 'next'
import { getPlatformSettings } from '@/lib/db/admin'
import { PageHeader } from '@/components/ui/PageHeader'
import { PlatformSettingsForm } from '@/components/admin/PlatformSettingsForm'

export const metadata: Metadata = {
  title: 'Settings \u2014 Lumscribe Admin',
}

export default async function AdminSettingsPage() {
  const settings = await getPlatformSettings()

  return (
    <>
      <PageHeader
        title="Platform Settings"
        description="Configure platform-wide settings."
      />

      <PlatformSettingsForm settings={settings} />
    </>
  )
}
