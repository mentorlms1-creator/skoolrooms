/**
 * app/(platform)/admin/settings/page.tsx — Platform settings
 *
 * Server Component. Displays platform settings for admin to toggle/edit.
 */

import type { Metadata } from 'next'
import { getPlatformSettings } from '@/lib/db/admin'
import { getPlatformSetting, hasEncryptedSetting } from '@/lib/platform/settings'
import { PageHeader } from '@/components/ui/PageHeader'
import { PlatformSettingsForm } from '@/components/admin/PlatformSettingsForm'
import { AIProviderSettings } from '@/components/admin/AIProviderSettings'

export const metadata: Metadata = {
  title: 'Settings — Skool Rooms Admin',
}

export default async function AdminSettingsPage() {
  const [settings, aiEnabled, aiBaseURL, aiModel, hasAIKey] = await Promise.all([
    getPlatformSettings(),
    getPlatformSetting('ai_lesson_planner_enabled'),
    getPlatformSetting('ai_provider_base_url'),
    getPlatformSetting('ai_provider_model'),
    hasEncryptedSetting('ai_provider_api_key'),
  ])

  return (
    <>
      <PageHeader title="Settings" />

      <PlatformSettingsForm settings={settings} />

      <div className="mt-6">
        <AIProviderSettings
          initialEnabled={aiEnabled === 'true' || aiEnabled === '1'}
          initialBaseURL={aiBaseURL ?? ''}
          initialModel={aiModel ?? ''}
          hasKey={hasAIKey}
        />
      </div>
    </>
  )
}
