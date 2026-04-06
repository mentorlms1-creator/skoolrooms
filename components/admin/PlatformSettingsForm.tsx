'use client'

/**
 * components/admin/PlatformSettingsForm.tsx — Editable platform settings
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { updatePlatformSettingsAction } from '@/lib/actions/admin'
import type { PlatformSettingRow } from '@/lib/db/admin'

type PlatformSettingsFormProps = {
  settings: PlatformSettingRow[]
}

// Settings that should be displayed as toggles (true/false values)
const TOGGLE_SETTINGS = [
  'screenshot_payments_enabled',
  'payment_gateway_enabled',
  'refund_debit_recovery_enabled',
]

export function PlatformSettingsForm({ settings }: PlatformSettingsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const s of settings) {
      initial[s.key] = s.value
    }
    return initial
  })

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const formData = new FormData()
    for (const [key, value] of Object.entries(values)) {
      formData.append(key, value)
    }

    const result = await updatePlatformSettingsAction(formData)

    if (result.success) {
      setMessage({ type: 'success', text: 'Settings saved.' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error })
    }

    setLoading(false)
  }

  if (settings.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No platform settings configured yet.</p>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      {message && (
        <div
          className={`mb-4 rounded-md px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      <Card className="divide-y divide-border">
        {settings.map((setting) => {
          const isToggle = TOGGLE_SETTINGS.includes(setting.key)

          return (
            <div key={setting.key} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-foreground">{formatSettingKey(setting.key)}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{setting.description}</p>
              </div>
              <div className="shrink-0">
                {isToggle ? (
                  <div className="flex min-h-[2.75rem] items-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={values[setting.key] === 'true'}
                      onClick={() =>
                        handleChange(
                          setting.key,
                          values[setting.key] === 'true' ? 'false' : 'true'
                        )
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        values[setting.key] === 'true' ? 'bg-primary' : 'bg-border'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                          values[setting.key] === 'true' ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ) : (
                  <Input
                    value={values[setting.key] ?? ''}
                    onChange={(e) => handleChange(setting.key, e.target.value)}
                    className="w-40"
                  />
                )}
              </div>
            </div>
          )
        })}
      </Card>

      <div className="mt-4 flex justify-end">
        <Button type="submit" loading={loading}>
          Save Settings
        </Button>
      </div>
    </form>
  )
}

function formatSettingKey(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
