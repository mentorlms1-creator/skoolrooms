import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { getPlanState, isContentCreateBlocked } from '@/lib/auth/plan-state'
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
// Wrapped in React cache() so repeated calls within the same request (e.g.
// layout + page) dedupe to a single Supabase lookup.
// =============================================================================

/**
 * Requires an authenticated teacher.
 * Returns the full `teachers` row.
 * Redirects to /login/teacher if not authenticated or no teacher row.
 * Redirects to /suspended if teacher is suspended.
 */
export const requireTeacher = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login/teacher')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('*')
    .eq('supabase_auth_id', user.id)
    .single()

  if (!teacher) redirect('/login/teacher')
  if (teacher.is_suspended) redirect('/suspended')

  return teacher
})

/**
 * Requires an authenticated teacher who can create new content.
 * Use this on pages whose only purpose is content-write (new course, new
 * cohort, new session, edit forms that publish/promote). Redirects soft-
 * downgraded and hard-locked teachers to /subscribe so they never reach a
 * form whose server action would just reject them.
 */
export const requireUnlockedTeacher = cache(async () => {
  const teacher = await requireTeacher()
  const state = getPlanState(teacher)
  if (isContentCreateBlocked(state)) redirect('/subscribe')
  return teacher
})

/**
 * Requires an authenticated student.
 * Returns the full `students` row.
 * Redirects to /student-login if not authenticated or no student row.
 */
export const requireStudent = cache(async () => {
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
})

/**
 * Requires an authenticated admin.
 * Checks user_metadata.role === 'admin'.
 * Returns the Supabase Auth user.
 * Redirects to /admin/login if not authenticated or not admin.
 */
export const requireAdmin = cache(async (): Promise<User> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/admin-login')
  if (user.user_metadata?.role !== 'admin') redirect('/admin-login')

  return user
})
