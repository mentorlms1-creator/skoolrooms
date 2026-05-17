'use client'

/**
 * components/admin/AIProviderSettings.tsx
 * Client Component — Admin form for the AI lesson planner provider.
 * Lets the admin configure base URL / model / API key, test connectivity
 * against candidate values, and persist on save.
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  saveAIProviderAction,
  testAIProviderAction,
} from '@/lib/actions/adminAIProvider'

type Props = {
  initialEnabled: boolean
  initialBaseURL: string
  initialModel: string
  hasKey: boolean
}

export function AIProviderSettings({
  initialEnabled,
  initialBaseURL,
  initialModel,
  hasKey,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [baseURL, setBaseURL] = useState(initialBaseURL)
  const [model, setModel] = useState(initialModel)
  const [keyMode, setKeyMode] = useState<'masked' | 'edit'>(
    hasKey ? 'masked' : 'edit',
  )
  const [apiKey, setApiKey] = useState('')
  const [pending, start] = useTransition()

  function onTest() {
    start(async () => {
      const res = await testAIProviderAction({
        baseURL,
        apiKey: keyMode === 'edit' ? apiKey : undefined,
        model,
      })
      if (res.success) {
        toast.success('Connection OK')
      } else {
        toast.error('Connection failed', { description: res.error })
      }
    })
  }

  function onSave() {
    start(async () => {
      const res = await saveAIProviderAction({
        enabled,
        baseURL,
        model,
        apiKey: keyMode === 'edit' && apiKey ? apiKey : undefined,
      })
      if (res.success) {
        toast.success('Settings saved')
        if (apiKey) {
          setKeyMode('masked')
          setApiKey('')
        }
      } else {
        toast.error('Save failed', { description: res.error })
      }
    })
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-6">
      <header>
        <h2 className="text-lg font-semibold text-foreground">
          AI Lesson Planner
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure the AI provider used to generate lesson plans. Works with
          any Anthropic-compatible endpoint. The base URL must include the
          version prefix (the SDK appends <code>/messages</code> to it).
        </p>
      </header>

      <div className="flex items-center justify-between">
        <Label htmlFor="ai-enabled">Enabled</Label>
        <Switch
          id="ai-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-base-url">Base URL</Label>
        <Input
          id="ai-base-url"
          value={baseURL}
          onChange={(e) => setBaseURL(e.target.value)}
          placeholder="https://api.anthropic.com/v1"
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-model">Model</Label>
        <Input
          id="ai-model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="claude-haiku-4-5"
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-key">API Key</Label>
        {keyMode === 'masked' ? (
          <div className="flex items-center gap-2">
            <Input id="ai-key" type="text" value="••••••••" readOnly />
            <Button
              variant="ghost"
              onClick={() => setKeyMode('edit')}
              disabled={pending}
            >
              Replace key
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              id="ai-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste new key"
              autoComplete="off"
              disabled={pending}
            />
            {hasKey && (
              <Button
                variant="ghost"
                onClick={() => {
                  setKeyMode('masked')
                  setApiKey('')
                }}
                disabled={pending}
              >
                Cancel
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onTest} disabled={pending}>
          Test connection
        </Button>
        <Button onClick={onSave} disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </section>
  )
}
