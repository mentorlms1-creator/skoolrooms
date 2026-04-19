'use server'

// =============================================================================
// lib/actions/admin-email.ts — Bulk email all active teachers
// =============================================================================

import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/supabase/server'
import { logAdminActivity } from '@/lib/db/admin'
import { sendEmail } from '@/lib/email/sender'
import { EmailType } from '@/types/domain'
import type { ApiResponse } from '@/types/api'

const BREVO_DAILY_LIMIT = 300
const BATCH_SIZE = 50

export async function bulkEmailTeachersAction(formData: FormData): Promise<
  ApiResponse<{ sent: number }> & { code?: string }
> {
  const admin = await requireAdmin()

  const subject = (formData.get('subject') as string | null)?.trim()
  const body = (formData.get('body') as string | null)?.trim()

  if (!subject || subject.length > 200) {
    return { success: false, error: 'Subject is required and must be under 200 characters.' }
  }
  if (!body || body.length > 5000) {
    return { success: false, error: 'Body is required and must be under 5000 characters.' }
  }

  const supabase = createAdminClient()

  // Pre-check Brevo daily limit
  const { count } = await supabase
    .from('teachers')
    .select('*', { count: 'exact', head: true })
    .eq('is_suspended', false)

  const teacherCount = count ?? 0
  if (teacherCount > BREVO_DAILY_LIMIT) {
    return {
      success: false,
      error: `Would exceed Brevo daily limit (300). Current teachers: ${teacherCount}. Upgrade Brevo plan to send to all.`,
      code: 'BREVO_LIMIT',
    }
  }

  // Fetch all non-suspended teachers
  const { data: teachers, error: fetchError } = await supabase
    .from('teachers')
    .select('id, email, name')
    .eq('is_suspended', false)

  if (fetchError || !teachers) {
    return { success: false, error: 'Failed to fetch teachers.' }
  }

  await logAdminActivity({
    actionType: 'bulk_email_sent',
    performedBy: admin.email ?? admin.id,
    metadata: { recipient_count: teachers.length, subject },
  })

  // Send in sequential batches of 50 to avoid hammering Brevo
  let sent = 0
  for (let i = 0; i < teachers.length; i += BATCH_SIZE) {
    const batch = teachers.slice(i, i + BATCH_SIZE)
    for (const teacher of batch) {
      await sendEmail({
        to: teacher.email as string,
        type: EmailType.ADMIN_BROADCAST,
        recipientId: teacher.id as string,
        recipientType: 'teacher',
        data: {
          teacherName: teacher.name as string,
          subject,
          body,
        },
      })
      sent++
    }
  }

  return { success: true, data: { sent } }
}
