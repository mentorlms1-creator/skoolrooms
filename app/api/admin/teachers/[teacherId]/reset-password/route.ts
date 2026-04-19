// =============================================================================
// app/api/admin/teachers/[teacherId]/reset-password/route.ts
// POST — Generate Supabase recovery link for teacher (admin only)
// =============================================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/supabase/server'
import { logAdminActivity } from '@/lib/db/admin'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ teacherId: string }> }
) {
  const admin = await requireAdmin()
  const { teacherId } = await params
  const supabase = createAdminClient()

  const { data: teacher, error: fetchError } = await supabase
    .from('teachers')
    .select('id, email')
    .eq('id', teacherId)
    .single()

  if (fetchError || !teacher) {
    return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: teacher.email as string,
  })

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: 'Failed to generate recovery link' }, { status: 500 })
  }

  await logAdminActivity({
    teacherId,
    actionType: 'password_reset_generated',
    performedBy: admin.email ?? admin.id,
    metadata: {
      teacher_id: teacherId,
      teacher_email: teacher.email as string,
    },
  })

  return NextResponse.json({ resetLink: linkData.properties.action_link })
}
