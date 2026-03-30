import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import type { User } from '@supabase/supabase-js'

// =============================================================================
// Auth guard functions for Server Components and Server Actions
//
// Usage:
//   const teacher = await requireTeacher()   // returns teacher row or redirects
//   const student = await requireStudent()   // returns student row or redirects
//   const admin   = await requireAdmin()     // returns Supabase user or redirects
//
// These NEVER return null — they redirect on failure.
// =============================================================================

/**
 * Requires an authenticated teacher.
 * Returns the full `teachers` row.
 * Redirects to /login if not authenticated or no teacher row.
 * Redirects to /suspended if teacher is suspended.
 */
export async function requireTeacher() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('*')
    .eq('supabase_auth_id', user.id)
    .single()

  if (!teacher) redirect('/login')
  if (teacher.is_suspended) redirect('/suspended')

  return teacher
}

/**
 * Requires an authenticated student.
 * Returns the full `students` row.
 * Redirects to /student-login if not authenticated or no student row.
 */
export async function requireStudent() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/student-login')

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('supabase_auth_id', user.id)
    .single()

  if (!student) redirect('/student-login')

  return student
}

/**
 * Requires an authenticated admin.
 * Checks user_metadata.role === 'admin'.
 * Returns the Supabase Auth user.
 * Redirects to /admin/login if not authenticated or not admin.
 */
export async function requireAdmin(): Promise<User> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/admin/login')
  if (user.user_metadata?.role !== 'admin') redirect('/admin/login')

  return user
}
