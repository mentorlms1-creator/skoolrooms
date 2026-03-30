import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

/**
 * POST /api/explore/track
 *
 * Public endpoint. Tracks explore page views per teacher.
 * Hashes IP via SHA-256 for privacy. Daily-unique per IP hash per teacher.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 60 track calls per IP per minute (generous for page load tracking)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const { allowed } = rateLimit(`explore-track:${ip}`, 60, 60_000)
    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const { teacherId, source } = body as { teacherId?: string; source?: string }

    if (!teacherId) {
      return NextResponse.json({ success: false, error: 'teacherId is required' }, { status: 400 })
    }

    // Hash IP via SHA-256 for privacy
    const encoder = new TextEncoder()
    const data = encoder.encode(ip)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const ipHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    const supabase = createAdminClient()

    // Check for daily uniqueness: same IP hash + same teacher + same day
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const { count } = await supabase
      .from('explore_page_views')
      .select('*', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('viewer_ip_hash', ipHash)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString())

    if ((count ?? 0) > 0) {
      // Already tracked today — success but no-op
      return NextResponse.json({ success: true, tracked: false })
    }

    // Insert the view
    const { error } = await supabase
      .from('explore_page_views')
      .insert({
        teacher_id: teacherId,
        viewer_ip_hash: ipHash,
        source: source ?? 'explore',
      })

    if (error) {
      console.error('[explore/track] Failed to insert view:', error.message)
      return NextResponse.json({ success: false, error: 'Failed to track view' }, { status: 500 })
    }

    return NextResponse.json({ success: true, tracked: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[explore/track] Unexpected error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
