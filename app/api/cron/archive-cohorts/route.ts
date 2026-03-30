import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/supabase/server'

export async function GET(request: NextRequest) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Find cohorts past end_date that aren't archived
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id')
    .lt('end_date', today)
    .neq('status', 'archived')
    .is('deleted_at', null)

  if (!cohorts || cohorts.length === 0) {
    return NextResponse.json({ success: true, archived: 0 })
  }

  const cohortIds = cohorts.map(c => c.id)

  // Archive all expired cohorts
  await supabase
    .from('cohorts')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
      is_registration_open: false,
      updated_at: new Date().toISOString(),
    })
    .in('id', cohortIds)

  // Auto-reject pending enrollments
  await supabase
    .from('enrollments')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .in('cohort_id', cohortIds)
    .eq('status', 'pending')

  // Expire waitlist entries
  await supabase
    .from('cohort_waitlist')
    .update({ status: 'expired' })
    .in('cohort_id', cohortIds)
    .eq('status', 'waiting')

  return NextResponse.json({ success: true, archived: cohortIds.length })
}
