'use server'

// =============================================================================
// lib/actions/adminAIProvider.ts — Admin actions for the AI lesson planner.
// testAIProviderAction: dry-run a configuration (candidate values) before save.
// saveAIProviderAction: upsert enabled/baseURL/model in platform_settings and
// store the API key via the encrypted-settings helpers.
// =============================================================================

export const maxDuration = 30

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/supabase/server'
import { makeAnthropicProvider } from '@/lib/ai/anthropic'
import { getProviderConfig } from '@/lib/ai/config'
import { setEncryptedSetting } from '@/lib/platform/settings'
import { rateLimit } from '@/lib/rate-limit'
import { logAdminActivity } from '@/lib/db/admin'
import type { ApiResponse } from '@/types/api'

// -----------------------------------------------------------------------------
// testAIProviderAction — Test connectivity with candidate (unsaved) values
// -----------------------------------------------------------------------------

const TestSchema = z.object({
  baseURL: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
})

export async function testAIProviderAction(
  input: unknown,
): Promise<ApiResponse<{ tested: true }>> {
  await requireAdmin()

  const parsed = TestSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' }
  }

  const rl = rateLimit('ai-test:admin', 1, 5_000)
  if (!rl.allowed) {
    return { success: false, error: 'Please wait a moment and try again.' }
  }

  const current = await getProviderConfig()
  const baseURL = parsed.data.baseURL || current.baseURL
  const apiKey = parsed.data.apiKey || current.apiKey
  const model = parsed.data.model || current.model

  if (!baseURL || !apiKey || !model) {
    return {
      success: false,
      error: 'Missing base URL, API key, or model.',
    }
  }

  const provider = makeAnthropicProvider({ baseURL, apiKey, model })
  const result = await provider.testConnection()
  if (result.ok) return { success: true, data: { tested: true } }
  return { success: false, error: result.error }
}

// -----------------------------------------------------------------------------
// saveAIProviderAction — Upsert plain settings + encrypt the API key
// -----------------------------------------------------------------------------

const SaveSchema = z.object({
  enabled: z.boolean(),
  baseURL: z.string().url(),
  model: z.string().min(1),
  apiKey: z.string().min(1).optional(), // omit / empty = leave existing key
})

export async function saveAIProviderAction(
  input: unknown,
): Promise<ApiResponse<null>> {
  const admin = await requireAdmin()

  const parsed = SaveSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' }
  }

  const supabase = createAdminClient()
  const rows = [
    {
      key: 'ai_lesson_planner_enabled',
      value: parsed.data.enabled ? 'true' : 'false',
      description: 'Master toggle for the AI lesson planner feature.',
    },
    {
      key: 'ai_provider_base_url',
      value: parsed.data.baseURL,
      description: 'Base URL for the Anthropic-compatible AI provider.',
    },
    {
      key: 'ai_provider_model',
      value: parsed.data.model,
      description: 'Model identifier passed to the AI provider.',
    },
  ]

  const { error } = await supabase.from('platform_settings').upsert(rows, {
    onConflict: 'key',
  })
  if (error) {
    return { success: false, error: error.message }
  }

  if (parsed.data.apiKey) {
    try {
      await setEncryptedSetting('ai_provider_api_key', parsed.data.apiKey)
    } catch (e) {
      return {
        success: false,
        error: (e as Error)?.message || 'Failed to encrypt key',
      }
    }
  }

  await logAdminActivity({
    actionType: 'update_ai_provider_settings',
    performedBy: admin.email ?? admin.id,
    metadata: {
      enabled: parsed.data.enabled,
      baseURL: parsed.data.baseURL,
      model: parsed.data.model,
      key_rotated: !!parsed.data.apiKey,
    },
  })

  revalidatePath('/admin/settings')
  return { success: true, data: null }
}
