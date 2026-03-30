// =============================================================================
// lib/platform/settings.ts — Platform settings with 1-minute in-memory cache
// Reads from the platform_settings table. All values stored as strings.
// Never hardcode platform settings — always use getPlatformSetting().
// =============================================================================

import { createAdminClient } from '@/supabase/server'
import type { FileType } from '@/types/domain'

// -----------------------------------------------------------------------------
// In-memory cache with 1-minute TTL
// -----------------------------------------------------------------------------

type CacheEntry = {
  value: string | null
  expiresAt: number
}

const CACHE_TTL_MS = 60_000 // 1 minute

const cache = new Map<string, CacheEntry>()

function getCached(key: string): string | null | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return undefined
  }
  return entry.value
}

function setCache(key: string, value: string | null): void {
  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

// -----------------------------------------------------------------------------
// Core getter
// -----------------------------------------------------------------------------

/**
 * Fetches a platform setting by key from the platform_settings table.
 * Results are cached in memory for 1 minute to avoid repeated DB queries.
 * Returns null if the key does not exist.
 */
export async function getPlatformSetting(key: string): Promise<string | null> {
  const cached = getCached(key)
  if (cached !== undefined) return cached

  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .single()

  if (error || !data) {
    setCache(key, null)
    return null
  }

  setCache(key, data.value)
  return data.value
}

// -----------------------------------------------------------------------------
// Convenience helpers
// -----------------------------------------------------------------------------

/**
 * Whether screenshot payment uploads are enabled on payment pages.
 * Reads platform_settings key: 'screenshot_payments_enabled'
 */
export async function isScreenshotPaymentsEnabled(): Promise<boolean> {
  const value = await getPlatformSetting('screenshot_payments_enabled')
  return value === 'true'
}

/**
 * Whether the payment gateway checkout flow is enabled.
 * Reads platform_settings key: 'payment_gateway_enabled'
 */
export async function isGatewayEnabled(): Promise<boolean> {
  const value = await getPlatformSetting('payment_gateway_enabled')
  return value === 'true'
}

/**
 * Minimum PKR balance required before a teacher can request a payout.
 * Reads platform_settings key: 'min_payout_amount_pkr'
 * Defaults to 2500 if not set.
 */
export async function getMinPayoutAmount(): Promise<number> {
  const value = await getPlatformSetting('min_payout_amount_pkr')
  return value ? parseInt(value, 10) : 2500
}

/**
 * Maximum upload size in MB for a given file type.
 * Reads from platform_settings using key pattern: 'r2_upload_limit_{type}_mb'
 * Screenshot limit is hardcoded at 10MB.
 */
export async function getUploadLimitMb(type: FileType): Promise<number> {
  // Screenshot limit is hardcoded per ARCHITECTURE.md Section 13
  if (type === 'screenshot') return 10

  const settingKey = `r2_upload_limit_${type}_mb`
  const value = await getPlatformSetting(settingKey)

  if (value) return parseInt(value, 10)

  // Fallback defaults matching seed data
  const defaults: Record<string, number> = {
    thumbnail: 5,
    profile: 2,
    qrcode: 2,
    assignment: 25,
    announcement: 25,
    submission: 50,
  }

  return defaults[type] ?? 5
}
