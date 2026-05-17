// =============================================================================
// lib/cloudflare/dns.ts — Subdomain DNS management via Cloudflare API
// Creates/deletes CNAME records for teacher subdomains.
// DNS propagates immediately for Cloudflare proxied records.
// =============================================================================

import { platformDomain } from '@/lib/platform/domain'

// -----------------------------------------------------------------------------
// Reserved subdomains — hard-blocked server-side
// From ARCHITECTURE.md Section 13
// -----------------------------------------------------------------------------
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  'www', 'students', 'admin', 'api', 'mail', 'smtp', 'ftp', 'pop', 'imap',
  'dev', 'staging', 'test', 'demo', 'app', 'dashboard', 'portal', 'help',
  'blog', 'docs', 'status', 'cdn', 'assets', 'static', 'files', 'media',
])

/**
 * Subdomain validation regex: lowercase alphanumeric + hyphens, 3-30 chars.
 * Must start and end with alphanumeric.
 */
export const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/

/**
 * Validates subdomain format and reserved list.
 * Returns an error string if invalid, null if valid.
 */
export function validateSubdomainFormat(subdomain: string): string | null {
  if (!SUBDOMAIN_REGEX.test(subdomain)) {
    return 'Subdomain must be 3-30 characters, lowercase letters, numbers, and hyphens only. Must start and end with a letter or number.'
  }
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return `The subdomain "${subdomain}" is reserved and cannot be used.`
  }
  return null
}

// -----------------------------------------------------------------------------
// Cloudflare API helpers
// -----------------------------------------------------------------------------

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4'

function getHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN!}`,
    'Content-Type': 'application/json',
  }
}

function getZoneId(): string {
  return process.env.CLOUDFLARE_ZONE_ID!
}

// -----------------------------------------------------------------------------
// Create subdomain CNAME record
// -----------------------------------------------------------------------------

/**
 * Creates a CNAME DNS record for a teacher subdomain.
 *
 * Target host is read from SUBDOMAIN_CNAME_TARGET env var. On Railway this
 * is the Railway-issued CNAME (e.g. dex9ih41.up.railway.app). The Railway
 * wildcard custom domain (*.skoolrooms.site) already covers all subdomains
 * at the SSL/routing layer, so this per-teacher record is mostly redundant —
 * kept for explicit auditability of which subdomains exist.
 *
 * If SUBDOMAIN_CNAME_TARGET is unset the call no-ops with success: true
 * (lets local dev work without touching Cloudflare).
 *
 * @returns { success: true } or { success: false, error: string }
 */
export async function createSubdomainRecord(
  subdomain: string,
): Promise<{ success: boolean; error?: string }> {
  const target = process.env.SUBDOMAIN_CNAME_TARGET
  if (!target) {
    return { success: true }
  }

  // Validate format
  if (!SUBDOMAIN_REGEX.test(subdomain)) {
    return {
      success: false,
      error: 'Subdomain must be 3-30 characters, lowercase letters, numbers, and hyphens only. Must start and end with a letter or number.',
    }
  }

  // Check reserved
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return {
      success: false,
      error: `The subdomain "${subdomain}" is reserved and cannot be used.`,
    }
  }

  try {
    const response = await fetch(
      `${CLOUDFLARE_API_BASE}/zones/${getZoneId()}/dns_records`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          type: 'CNAME',
          name: `${subdomain}.${platformDomain()}`,
          content: target,
          proxied: true,
          ttl: 1, // Auto TTL when proxied
        }),
      },
    )

    const result = (await response.json()) as {
      success: boolean
      errors?: Array<{ message: string }>
    }

    if (!result.success) {
      const errorMsg = result.errors?.[0]?.message || 'Failed to create DNS record'
      return { success: false, error: errorMsg }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[createSubdomainRecord] Failed for ${subdomain}:`, message)
    return { success: false, error: `DNS creation failed: ${message}` }
  }
}

// -----------------------------------------------------------------------------
// Delete subdomain CNAME record
// -----------------------------------------------------------------------------

/**
 * Deletes the CNAME DNS record for a teacher subdomain.
 *
 * Steps:
 * 1. Look up the DNS record ID by name
 * 2. DELETE the record via Cloudflare API
 *
 * @returns { success: true } or { success: false, error: string }
 */
export async function deleteSubdomainRecord(
  subdomain: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const fullName = `${subdomain}.${platformDomain()}`

    // Step 1: Find the record ID
    const listResponse = await fetch(
      `${CLOUDFLARE_API_BASE}/zones/${getZoneId()}/dns_records?type=CNAME&name=${encodeURIComponent(fullName)}`,
      {
        method: 'GET',
        headers: getHeaders(),
      },
    )

    const listResult = (await listResponse.json()) as {
      success: boolean
      result?: Array<{ id: string }>
      errors?: Array<{ message: string }>
    }

    if (!listResult.success || !listResult.result?.length) {
      return {
        success: false,
        error: `DNS record not found for ${subdomain}`,
      }
    }

    const recordId = listResult.result[0].id

    // Step 2: Delete the record
    const deleteResponse = await fetch(
      `${CLOUDFLARE_API_BASE}/zones/${getZoneId()}/dns_records/${recordId}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      },
    )

    const deleteResult = (await deleteResponse.json()) as {
      success: boolean
      errors?: Array<{ message: string }>
    }

    if (!deleteResult.success) {
      const errorMsg = deleteResult.errors?.[0]?.message || 'Failed to delete DNS record'
      return { success: false, error: errorMsg }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[deleteSubdomainRecord] Failed for ${subdomain}:`, message)
    return { success: false, error: `DNS deletion failed: ${message}` }
  }
}
