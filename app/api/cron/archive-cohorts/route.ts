import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/supabase/server'

export async function GET(request: NextRequest) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]

    // Find cohorts past end_date that aren't archived
    const { data: cohorts, error: fetchError } = await supabase
      .from('cohorts')
      .select('id')
      .lt('end_date', today)
      .neq('status', 'archived')
      .is('deleted_at', null)

    if (fetchError) {
      console.error('[cron:archive-cohorts] Failed to fetch expired cohorts:', fetchError.message)
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }

    if (!cohorts || cohorts.length === 0) {
      return NextResponse.json({ success: true, archived: 0 })
    }

    const cohortIds = cohorts.map(c => c.id)
    console.log(`[cron:archive-cohorts] Archiving ${cohortIds.length} expired cohorts`)

    // Archive all expired cohorts
    const { error: archiveError } = await supabase
      .from('cohorts')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        is_registration_open: false,
        updated_at: new Date().toISOString(),
      })
      .in('id', cohortIds)

    if (archiveError) {
      console.error('[cron:archive-cohorts] Failed to archive cohorts:', archiveError.message)
      return NextResponse.json({ success: false, error: archiveError.message }, { status: 500 })
    }

    // Auto-reject pending enrollments
    const { error: rejectError } = await supabase
      .from('enrollments')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .in('cohort_id', cohortIds)
      .eq('status', 'pending')

    if (rejectError) {
      console.error('[cron:archive-cohorts] Failed to reject pending enrollments:', rejectError.message)
    }

    // Expire waitlist entries
    const { error: waitlistError } = await supabase
      .from('cohort_waitlist')
      .update({ status: 'expired' })
      .in('cohort_id', cohortIds)
      .eq('status', 'waiting')

    if (waitlistError) {
      console.error('[cron:archive-cohorts] Failed to expire waitlist entries:', waitlistError.message)
    }

    console.log(`[cron:archive-cohorts] Done. Archived ${cohortIds.length} cohorts`)
    return NextResponse.json({ success: true, archived: cohortIds.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[cron:archive-cohorts] Unexpected error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
