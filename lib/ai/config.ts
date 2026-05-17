// =============================================================================
// lib/ai/config.ts — AI provider configuration.
// Reads platform_settings (admin-controlled) with env-var fallback.
// Never cached — admin changes take effect immediately.
// =============================================================================

import { getPlatformSetting, getEncryptedSetting } from '@/lib/platform/settings'

export type ProviderConfig = {
  enabled: boolean
  baseURL: string
  apiKey: string
  model: string
}

const PLAIN_KEYS = {
  enabled: 'ai_lesson_planner_enabled',
  baseURL: 'ai_provider_base_url',
  model: 'ai_provider_model',
} as const

const ENCRYPTED_KEY = 'ai_provider_api_key'

export const AI_SETTING_KEYS = { ...PLAIN_KEYS, apiKey: ENCRYPTED_KEY } as const

/**
 * Resolves the AI provider config from platform_settings (preferred) with
 * env-var fallback. `enabled` is true only when the toggle is on AND all three
 * other values (baseURL, apiKey, model) are present.
 */
export async function getProviderConfig(): Promise<ProviderConfig> {
  const [enabledRaw, baseURL, model, apiKey] = await Promise.all([
    getPlatformSetting(PLAIN_KEYS.enabled),
    getPlatformSetting(PLAIN_KEYS.baseURL),
    getPlatformSetting(PLAIN_KEYS.model),
    getEncryptedSetting(ENCRYPTED_KEY),
  ])

  const resolvedBaseURL = baseURL || process.env.AI_BASE_URL || ''
  const resolvedModel = model || process.env.AI_MODEL || ''
  const resolvedKey = apiKey || process.env.AI_API_KEY || ''
  const toggleOn = enabledRaw === 'true' || enabledRaw === '1'
  const enabled = toggleOn && !!resolvedBaseURL && !!resolvedKey && !!resolvedModel

  return {
    enabled,
    baseURL: resolvedBaseURL,
    apiKey: resolvedKey,
    model: resolvedModel,
  }
}
