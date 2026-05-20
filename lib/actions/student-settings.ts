'use server'

import { createClient } from '@/supabase/server'
import { createAdminClient } from '@/supabase/server'
import { getStudentByAuthId } from '@/lib/db/students'
import { updateStudent } from '@/lib/db/students'
import { deleteR2File } from '@/lib/r2/upload'
import type { ApiResponse } from '@/types/api'

/**
 * Update the signed-in student's profile (name, phone, optional photo).
 *
 * FormData fields:
 *  - name (required, min 2 chars)
 *  - phone (required)
 *  - profile_photo_url (optional; always send — empty string = clear photo)
 *
 * On photo replace/clear, the previous R2 object is deleted to avoid orphans.
 */
export async function updateStudentProfileAction(
  formData: FormData,
): Promise<ApiResponse<null>> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { success: false, error: 'Not authenticated' }

  const student = await getStudentByAuthId(user.id)
  if (!student) return { success: false, error: 'Student not found' }

  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()

  if (!name || name.length < 2) {
    return { success: false, error: 'Name must be at least 2 characters' }
  }
  if (!phone) {
    return { success: false, error: 'Phone number is required' }
  }

  // Photo handling. Field is only honored if it's present in FormData —
  // omission means "don't change". Empty string = explicit clear.
  const photoRaw = formData.get('profile_photo_url')
  const photoFieldPresent = photoRaw !== null
  const nextPhotoUrl = photoFieldPresent ? String(photoRaw).trim() : undefined

  if (photoFieldPresent) {
    const currentPhotoUrl = (student.profile_photo_url as string | null) ?? ''

    // If the value differs from what's currently stored and there WAS an old
    // photo, delete the old R2 object before saving the new URL (or clearing).
    if (currentPhotoUrl && currentPhotoUrl !== nextPhotoUrl) {
      const oldKey = r2KeyFromPublicUrl(currentPhotoUrl)
      if (oldKey) {
        try {
          await deleteR2File(oldKey)
        } catch (e) {
          // Best-effort cleanup; never block the profile save on R2 failure.
          console.error('[updateStudentProfileAction] R2 cleanup failed:', e)
        }
      }
    }
  }

  await updateStudent(student.id, {
    name,
    phone,
    // Only include profile_photo_url in the update if the field was sent.
    ...(photoFieldPresent
      ? { profile_photo_url: nextPhotoUrl === '' ? null : nextPhotoUrl }
      : {}),
  })

  return { success: true, data: null }
}

/**
 * Strip the CLOUDFLARE_R2_PUBLIC_URL prefix from a stored URL to recover the
 * object key. Returns null if the URL doesn't match the configured prefix
 * (defensive: avoids deleting an unrelated object).
 */
function r2KeyFromPublicUrl(publicUrl: string): string | null {
  const base = process.env.CLOUDFLARE_R2_PUBLIC_URL
  if (!base) return null
  const normalized = base.endsWith('/') ? base : `${base}/`
  if (!publicUrl.startsWith(normalized)) return null
  return publicUrl.slice(normalized.length)
}
