'use server'

// =============================================================================
// lib/actions/testimonials.ts — Server actions for teacher testimonials
// =============================================================================

import { createClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import {
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  getTestimonialsByTeacher,
  type TestimonialRow,
} from '@/lib/db/testimonials'
import { createAdminClient } from '@/supabase/server'
import { revalidatePath } from 'next/cache'
import { revalidateTag } from '@/lib/cache/tags'
import type { ApiResponse } from '@/types/api'

async function getAuthenticatedTeacher() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return getTeacherByAuthId(user.id)
}

async function verifyTestimonialOwnership(testimonialId: string, teacherId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('teacher_testimonials')
    .select('id, teacher_id, display_order')
    .eq('id', testimonialId)
    .single()

  if (!data || (data.teacher_id as string) !== teacherId) return null
  return data as { id: string; teacher_id: string; display_order: number }
}

// -----------------------------------------------------------------------------
// createTestimonialAction — Teacher creates a new testimonial
// -----------------------------------------------------------------------------
export async function createTestimonialAction(
  formData: FormData
): Promise<ApiResponse<{ id: string }>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }

  const authorName = (formData.get('author_name') as string | null)?.trim() ?? ''
  const authorRole = (formData.get('author_role') as string | null)?.trim() ?? ''
  const quote = (formData.get('quote') as string | null)?.trim() ?? ''
  const isPublished = formData.get('is_published') === 'true'

  if (!authorName) return { success: false, error: 'Author name is required.' }
  if (!quote) return { success: false, error: 'Quote is required.' }
  if (quote.length < 10) return { success: false, error: 'Quote must be at least 10 characters.' }

  // Get current count to set display_order
  const existingList = await getTestimonialsByTeacher(teacher.id)
  const displayOrder = existingList.length

  const testimonial = await createTestimonial({
    teacherId: teacher.id,
    authorName,
    authorRole: authorRole || null,
    quote,
    isPublished,
    displayOrder,
  })

  if (!testimonial) return { success: false, error: 'Failed to create testimonial.' }

  revalidatePath('/dashboard/settings/testimonials')
  revalidateTag(`teacher-testimonials:${teacher.id}`)
  revalidateTag(`teacher:${teacher.id}`)

  return { success: true, data: { id: testimonial.id } }
}

// -----------------------------------------------------------------------------
// updateTestimonialAction — Teacher updates a testimonial
// -----------------------------------------------------------------------------
export async function updateTestimonialAction(
  testimonialId: string,
  formData: FormData
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }

  const owned = await verifyTestimonialOwnership(testimonialId, teacher.id)
  if (!owned) return { success: false, error: 'Testimonial not found.' }

  const authorName = (formData.get('author_name') as string | null)?.trim()
  const authorRole = (formData.get('author_role') as string | null)?.trim()
  const quote = (formData.get('quote') as string | null)?.trim()
  const isPublishedRaw = formData.get('is_published') as string | null

  if (authorName !== undefined && !authorName) {
    return { success: false, error: 'Author name is required.' }
  }
  if (quote !== undefined && quote.length < 10) {
    return { success: false, error: 'Quote must be at least 10 characters.' }
  }

  const updated = await updateTestimonial(testimonialId, {
    ...(authorName !== undefined ? { authorName } : {}),
    ...(authorRole !== undefined ? { authorRole: authorRole || null } : {}),
    ...(quote !== undefined ? { quote } : {}),
    ...(isPublishedRaw !== null ? { isPublished: isPublishedRaw === 'true' } : {}),
  })

  if (!updated) return { success: false, error: 'Failed to update testimonial.' }

  revalidatePath('/dashboard/settings/testimonials')
  revalidateTag(`teacher-testimonials:${teacher.id}`)
  revalidateTag(`teacher:${teacher.id}`)

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// deleteTestimonialAction — Teacher deletes a testimonial
// -----------------------------------------------------------------------------
export async function deleteTestimonialAction(
  testimonialId: string
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }

  const owned = await verifyTestimonialOwnership(testimonialId, teacher.id)
  if (!owned) return { success: false, error: 'Testimonial not found.' }

  const success = await deleteTestimonial(testimonialId)
  if (!success) return { success: false, error: 'Failed to delete testimonial.' }

  revalidatePath('/dashboard/settings/testimonials')
  revalidateTag(`teacher-testimonials:${teacher.id}`)
  revalidateTag(`teacher:${teacher.id}`)

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// reorderTestimonialsAction — Move a testimonial up or down
// -----------------------------------------------------------------------------
export async function reorderTestimonialsAction(
  testimonialId: string,
  direction: 'up' | 'down'
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }

  const owned = await verifyTestimonialOwnership(testimonialId, teacher.id)
  if (!owned) return { success: false, error: 'Testimonial not found.' }

  const all = await getTestimonialsByTeacher(teacher.id)
  const idx = all.findIndex((t) => t.id === testimonialId)
  if (idx === -1) return { success: false, error: 'Testimonial not found.' }

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= all.length) {
    return { success: false, error: 'Cannot move testimonial in that direction.' }
  }

  const current = all[idx]
  const neighbor = all[swapIdx]

  // Swap display_order values
  await Promise.all([
    updateTestimonial(current.id, { displayOrder: neighbor.display_order }),
    updateTestimonial(neighbor.id, { displayOrder: current.display_order }),
  ])

  revalidatePath('/dashboard/settings/testimonials')
  revalidateTag(`teacher-testimonials:${teacher.id}`)
  revalidateTag(`teacher:${teacher.id}`)

  return { success: true, data: null }
}
