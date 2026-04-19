'use server'

import { requireTeacher } from '@/lib/auth/guards'
import { createAdminClient } from '@/supabase/server'
import {
  createSubdomainRecord,
  deleteSubdomainRecord,
  validateSubdomainFormat,
} from '@/lib/cloudflare/dns'
import { sendEmail } from '@/lib/email/sender'
import { teacherSubdomainUrl } from '@/lib/platform/domain'

export async function changeSubdomainAction(
  newSubdomain: string,
): Promise<{ success: true } | { success: false; error: string; code?: string }> {
  const teacher = await requireTeacher()
  const teacherId = teacher.id as string
  const supabase = createAdminClient()

  // Validate format and reserved list
  const formatError = validateSubdomainFormat(newSubdomain)
  if (formatError) return { success: false, error: formatError }

  // Enforce 30-day cooldown
  if (teacher.subdomain_changed_at) {
    const changedAt = new Date(teacher.subdomain_changed_at as string)
    const cooldownEnd = new Date(changedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
    if (new Date() < cooldownEnd) {
      return {
        success: false,
        error: `You can change your subdomain again after ${cooldownEnd.toLocaleDateString('en-PK')}.`,
        code: 'SUBDOMAIN_COOLDOWN_ACTIVE',
      }
    }
  }

  // Check DB uniqueness
  const { data: existing } = await supabase
    .from('teachers')
    .select('id')
    .eq('subdomain', newSubdomain)
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'This subdomain is already taken. Please choose another.' }
  }

  const oldSubdomain = teacher.subdomain as string

  // Create new DNS record first — if this fails, DB is not touched
  const createResult = await createSubdomainRecord(newSubdomain)
  if (!createResult.success) {
    return { success: false, error: createResult.error ?? 'Failed to create DNS record.' }
  }

  // Update DB
  const { error: dbError } = await supabase
    .from('teachers')
    .update({
      subdomain: newSubdomain,
      subdomain_changed_at: new Date().toISOString(),
    })
    .eq('id', teacherId)

  if (dbError) {
    // Rollback: delete the new DNS record we just created
    await deleteSubdomainRecord(newSubdomain)
    return { success: false, error: 'Failed to update subdomain. Please try again.' }
  }

  // Delete old DNS record — best-effort, don't fail the action if this errors
  const deleteResult = await deleteSubdomainRecord(oldSubdomain)
  if (!deleteResult.success) {
    // TODO: old DNS record for subdomain "${oldSubdomain}" orphaned — admin cleanup needed
    console.warn(`[changeSubdomainAction] Failed to delete old DNS record for "${oldSubdomain}":`, deleteResult.error)
  }

  // Send confirmation email
  await sendEmail({
    to: teacher.email as string,
    type: 'subdomain_changed',
    recipientId: teacherId,
    recipientType: 'teacher',
    data: {
      teacherName: teacher.name,
      oldSubdomain,
      newSubdomain,
      oldUrl: teacherSubdomainUrl(oldSubdomain),
      newUrl: teacherSubdomainUrl(newSubdomain),
    },
  })

  return { success: true }
}
