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
  title: 'Settings — Lumscribe Admin',
}

export default async function AdminSettingsPage() {
  const settings = await getPlatformSettings()

  return (
    <>
      <PageHeader title="Settings" />

      <PlatformSettingsForm settings={settings} />
    </>
  )
}
