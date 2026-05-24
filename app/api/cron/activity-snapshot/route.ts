/**
 * app/api/cron/activity-snapshot/route.ts
 *
 * Records one row per day in teacher_activity_snapshots so the admin
 * dashboard can chart WAU/DAU over time. Schedule once per day
 * (e.g. 00:05 PKT) via cron-job.org with header
 *   Authorization: Bearer ${CRON_SECRET}
 *
 * Idempotent: re-running on the same date updates the existing row.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/supabase/server'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const now = new Date()
    const day = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [{ count: dailyActive }, { count: weeklyActive }, { count: totalTeachers }] =
      await Promise.all([
        supabase
          .from('teachers')
          .select('id', { count: 'exact', head: true })
          .gte('last_seen_at', day),
        supabase
          .from('teachers')
          .select('id', { count: 'exact', head: true })
          .gte('last_seen_at', week),
        supabase.from('teachers').select('id', { count: 'exact', head: true }),
      ])

    // Snapshot key = today's PKT calendar date.
    const pktNow = new Date(now.getTime() + 5 * 60 * 60 * 1000)
    const snapshotDate = pktNow.toISOString().split('T')[0]

    const { error } = await supabase
      .from('teacher_activity_snapshots')
      .upsert(
        {
          snapshot_date: snapshotDate,
          weekly_active: weeklyActive ?? 0,
          daily_active: dailyActive ?? 0,
          total_teachers: totalTeachers ?? 0,
        },
        { onConflict: 'snapshot_date' },
      )

    if (error) {
      console.error('[cron:activity-snapshot] upsert failed', error.message)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      snapshot_date: snapshotDate,
      weekly_active: weeklyActive ?? 0,
      daily_active: dailyActive ?? 0,
      total_teachers: totalTeachers ?? 0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[cron:activity-snapshot] unexpected', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
