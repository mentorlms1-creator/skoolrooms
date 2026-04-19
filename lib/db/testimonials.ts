// =============================================================================
// lib/db/testimonials.ts — Teacher testimonials CRUD queries (service layer)
// =============================================================================

import { createAdminClient } from '@/supabase/server'

export type TestimonialRow = {
  id: string
  teacher_id: string
  author_name: string
  author_role: string | null
  quote: string
  is_published: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export type CreateTestimonialInput = {
  teacherId: string
  authorName: string
  authorRole?: string | null
  quote: string
  isPublished?: boolean
  displayOrder?: number
}

export type UpdateTestimonialInput = {
  authorName?: string
  authorRole?: string | null
  quote?: string
  isPublished?: boolean
  displayOrder?: number
}

// -----------------------------------------------------------------------------
// getTestimonialsByTeacher — All testimonials for a teacher (teacher dashboard)
// -----------------------------------------------------------------------------
export async function getTestimonialsByTeacher(
  teacherId: string
): Promise<TestimonialRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teacher_testimonials')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('display_order', { ascending: true })

  if (error || !data) return []
  return data as TestimonialRow[]
}

// -----------------------------------------------------------------------------
// getPublishedTestimonialsByTeacher — Published testimonials for public page
// No auth required — uses admin client (bypasses RLS) for efficiency
// -----------------------------------------------------------------------------
export async function getPublishedTestimonialsByTeacher(
  teacherId: string
): Promise<TestimonialRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teacher_testimonials')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('is_published', true)
    .order('display_order', { ascending: true })

  if (error || !data) return []
  return data as TestimonialRow[]
}

// -----------------------------------------------------------------------------
// createTestimonial — Insert a new testimonial
// -----------------------------------------------------------------------------
export async function createTestimonial(
  input: CreateTestimonialInput
): Promise<TestimonialRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teacher_testimonials')
    .insert({
      teacher_id: input.teacherId,
      author_name: input.authorName,
      author_role: input.authorRole ?? null,
      quote: input.quote,
      is_published: input.isPublished ?? false,
      display_order: input.displayOrder ?? 0,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return data as TestimonialRow
}

// -----------------------------------------------------------------------------
// updateTestimonial — Update a testimonial by ID
// -----------------------------------------------------------------------------
export async function updateTestimonial(
  id: string,
  input: UpdateTestimonialInput
): Promise<TestimonialRow | null> {
  const supabase = createAdminClient()

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (input.authorName !== undefined) updatePayload.author_name = input.authorName
  if ('authorRole' in input) updatePayload.author_role = input.authorRole ?? null
  if (input.quote !== undefined) updatePayload.quote = input.quote
  if (input.isPublished !== undefined) updatePayload.is_published = input.isPublished
  if (input.displayOrder !== undefined) updatePayload.display_order = input.displayOrder

  const { data, error } = await supabase
    .from('teacher_testimonials')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) return null
  return data as TestimonialRow
}

// -----------------------------------------------------------------------------
// deleteTestimonial — Delete a testimonial by ID
// -----------------------------------------------------------------------------
export async function deleteTestimonial(id: string): Promise<boolean> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('teacher_testimonials')
    .delete()
    .eq('id', id)

  return !error
}
