// =============================================================================
// app/api/cloudflare/subdomain/route.ts — Cloudflare DNS subdomain management
// POST: Create a subdomain CNAME record + update teacher's subdomain in DB
// GET:  Check subdomain availability (reserved list + DB uniqueness)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/supabase/server'
import { createSubdomainRecord } from '@/lib/cloudflare/dns'
import { RESERVED_SUBDOMAINS } from '@/constants/plans'
import type { ApiResponse } from '@/types/api'

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Subdomain must be 3-30 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphens */
const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/

const reservedSet = new Set(RESERVED_SUBDOMAINS)

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function validateSubdomain(subdomain: string): string | null {
  if (!SUBDOMAIN_REGEX.test(subdomain)) {
    return 'Subdomain must be 3-30 characters, lowercase letters, numbers, and hyphens only. Must start and end with a letter or number.'
  }
  if (reservedSet.has(subdomain)) {
    return `The subdomain "${subdomain}" is reserved and cannot be used.`
  }
  return null
}

/**
 * Checks if a subdomain is already taken by another teacher in the database.
 * Uses admin client to bypass RLS (needs to check all teachers).
 */
async function isSubdomainTakenInDb(subdomain: string, excludeTeacherId?: string): Promise<boolean> {
  const adminClient = createAdminClient()

  let query = adminClient
    .from('teachers')
    .select('id')
    .eq('subdomain', subdomain)
    .limit(1)

  if (excludeTeacherId) {
    query = query.neq('id', excludeTeacherId)
  }

  const { data } = await query

  return (data?.length ?? 0) > 0
}

// -----------------------------------------------------------------------------
// GET /api/cloudflare/subdomain?check=subdomain-name
// Check availability without creating the record
// -----------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ available: boolean }>>> {
  // Auth check
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  // Get subdomain from query
  const subdomain = request.nextUrl.searchParams.get('check')

  if (!subdomain) {
    return NextResponse.json(
      { success: false, error: 'Missing "check" query parameter' },
      { status: 400 },
    )
  }

  const normalized = subdomain.toLowerCase()

  // Validate format + reserved list
  const validationError = validateSubdomain(normalized)
  if (validationError) {
    return NextResponse.json({
      success: true,
      data: { available: false },
    })
  }

  // Check DB uniqueness
  const taken = await isSubdomainTakenInDb(normalized)

  return NextResponse.json({
    success: true,
    data: { available: !taken },
  })
}

// -----------------------------------------------------------------------------
// POST /api/cloudflare/subdomain
// Create DNS record + update teacher's subdomain in DB
// -----------------------------------------------------------------------------

type SubdomainCreateOutput = {
  subdomain: string
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<SubdomainCreateOutput>>> {
  // 1. Auth check
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  // 2. Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const { subdomain } = body as { subdomain?: string }

  if (!subdomain) {
    return NextResponse.json(
      { success: false, error: 'Missing required field: subdomain' },
      { status: 400 },
    )
  }

  const normalized = subdomain.toLowerCase()

  // 3. Validate format + reserved list
  const validationError = validateSubdomain(normalized)
  if (validationError) {
    return NextResponse.json(
      { success: false, error: validationError },
      { status: 400 },
    )
  }

  // 4. Get the teacher record for this user
  const adminClient = createAdminClient()

  const { data: teacher, error: teacherError } = await adminClient
    .from('teachers')
    .select('id, subdomain')
    .eq('user_id', user.id)
    .single()

  if (teacherError || !teacher) {
    return NextResponse.json(
      { success: false, error: 'Teacher profile not found' },
      { status: 404 },
    )
  }

  // 5. Check DB uniqueness (exclude current teacher so they can re-set same subdomain)
  const taken = await isSubdomainTakenInDb(normalized, teacher.id)
  if (taken) {
    return NextResponse.json(
      { success: false, error: `The subdomain "${normalized}" is already taken.` },
      { status: 409 },
    )
  }

  // 6. Create DNS record via Cloudflare
  const dnsResult = await createSubdomainRecord(normalized)

  if (!dnsResult.success) {
    return NextResponse.json(
      { success: false, error: dnsResult.error ?? 'Failed to create DNS record' },
      { status: 500 },
    )
  }

  // 7. Update teacher's subdomain in DB
  const { error: updateError } = await adminClient
    .from('teachers')
    .update({
      subdomain: normalized,
      subdomain_changed_at: new Date().toISOString(),
    })
    .eq('id', teacher.id)

  if (updateError) {
    console.error('[subdomain] DB update failed:', updateError.message)
    return NextResponse.json(
      { success: false, error: 'DNS record created but failed to update teacher profile. Please contact support.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    data: { subdomain: normalized },
  })
}
