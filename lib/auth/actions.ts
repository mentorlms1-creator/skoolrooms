'use server'

import { createClient, createAdminClient } from '@/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { platformUrl } from '@/lib/platform/domain'
import { rateLimit } from '@/lib/rate-limit'
import type { ApiResponse } from '@/types/api'

// =============================================================================
// Auth Server Actions
//
// Per CLAUDE.md: mutations use Server Actions, NOT client-side fetch() to API
// routes. API routes exist only for webhooks, crons, and external integrations.
// =============================================================================

/**
 * Sign up a new teacher.
 * Creates Supabase auth user + teachers row (plan='free') + teacher_balances row.
 * Sends verification email via Supabase.
 */
export async function signUpTeacher(
  formData: FormData
): Promise<ApiResponse<{ teacherId: string }>> {
  // Rate limit: 10 teacher signups per IP per hour
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { allowed } = rateLimit(`teacher-signup:${ip}`, 10, 60 * 60 * 1000)
  if (!allowed) {
    return { success: false, error: 'Too many signup attempts. Please try again later.' }
  }

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!name || !email || !password) {
    return { success: false, error: 'All fields are required' }
  }
  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters' }
  }

  const supabaseAdmin = createAdminClient()

  // Create auth user with teacher role metadata
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { role: 'teacher', name },
    })

  if (authError) {
    if (authError.message.includes('already')) {
      return {
        success: false,
        error: 'An account with this email already exists',
        code: 'EMAIL_EXISTS',
      }
    }
    return { success: false, error: authError.message }
  }

  // Generate temp subdomain from name (teacher picks final subdomain in onboarding)
  const tempSubdomain =
    name.toLowerCase().replace(/[^a-z0-9]/g, '') +
    '-' +
    Date.now().toString(36)

  // Create teacher row — starts on free plan, no trial, no expiry
  const { data: teacher, error: teacherError } = await supabaseAdmin
    .from('teachers')
    .insert({
      supabase_auth_id: authData.user.id,
      name,
      email,
      subdomain: tempSubdomain,
      plan: 'free',
    })
    .select('id')
    .single()

  if (teacherError) {
    // Clean up: remove the auth user we just created
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return { success: false, error: 'Failed to create teacher profile' }
  }

  // Create teacher_balances row (starts at 0)
  await supabaseAdmin
    .from('teacher_balances')
    .insert({ teacher_id: teacher.id })

  // Send verification email via Supabase Auth
  await supabaseAdmin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: { redirectTo: platformUrl('/auth/callback') },
  })

  return { success: true, data: { teacherId: teacher.id } }
}

/**
 * Sign up a new student.
 * Creates Supabase auth user + students row.
 * Students are auto-confirmed (they verify via enrollment).
 */
export async function signUpStudent(
  formData: FormData
): Promise<ApiResponse<{ studentId: string }>> {
  // Rate limit: 3 student signups per IP per hour
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { allowed } = rateLimit(`student-signup:${ip}`, 3, 60 * 60 * 1000)
  if (!allowed) {
    return { success: false, error: 'Too many signup attempts. Please try again later.' }
  }

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const password = formData.get('password') as string

  if (!name || !email || !phone || !password) {
    return { success: false, error: 'All fields are required' }
  }
  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters' }
  }

  const supabaseAdmin = createAdminClient()

  // Check if student with this email already exists in students table
  const { data: existing } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('email', email)
    .single()

  if (existing) {
    return {
      success: false,
      error: 'An account with this email already exists',
      code: 'EMAIL_EXISTS',
    }
  }

  // Create auth user — auto-confirmed for students
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'student', name },
    })

  if (authError) {
    if (authError.message.includes('already')) {
      return {
        success: false,
        error: 'An account with this email already exists',
        code: 'EMAIL_EXISTS',
      }
    }
    return { success: false, error: authError.message }
  }

  // Create student row
  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .insert({
      supabase_auth_id: authData.user.id,
      name,
      email,
      phone,
    })
    .select('id')
    .single()

  if (studentError) {
    // Clean up: remove the auth user we just created
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return { success: false, error: 'Failed to create student profile' }
  }

  return { success: true, data: { studentId: student.id } }
}

/**
 * Sign in an existing user (teacher, student, or admin).
 * Returns the user's role from metadata.
 */
export async function signIn(
  formData: FormData
): Promise<ApiResponse<{ role: string }>> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { success: false, error: 'Email and password are required' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { success: false, error: 'Invalid email or password' }
  }

  const role = (data.user.user_metadata?.role as string) || 'teacher'
  return { success: true, data: { role } }
}

/**
 * Sign in action for useActionState — works as progressive enhancement.
 * The form submits as a native POST even before React hydrates (iOS fix).
 * On success, redirects server-side (no client-side router.push needed).
 */
export async function signInAction(
  portalType: 'teacher' | 'student',
  redirectTo: string,
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: 'Invalid email or password' }
  }

  const role = (data.user.user_metadata?.role as string) || 'teacher'

  // Portal mismatch checks
  if (portalType === 'teacher' && role === 'student') {
    await supabase.auth.signOut()
    return { error: 'This is the teacher login. Please use the student portal to sign in.' }
  }
  if (portalType === 'student' && role === 'teacher') {
    await supabase.auth.signOut()
    return { error: 'This is the student portal. Please use the teacher login to sign in.' }
  }

  // Server-side redirect — cookies are already set, no hydration needed
  redirect(redirectTo)
}

/**
 * Sign out the current user (teacher/admin) and redirect to login.
 */
export async function signOut(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login/teacher')
}

/**
 * Sign out the current student user and redirect to student login.
 */
export async function signOutStudent(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/student-login')
}

/**
 * Request a password reset email.
 * Works for both teachers and students — Supabase handles the email.
 */
export async function resetPassword(
  formData: FormData
): Promise<ApiResponse<null>> {
  const email = formData.get('email') as string

  if (!email) {
    return { success: false, error: 'Email is required' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: platformUrl('/auth/reset-password'),
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: null }
}

/**
 * Update the current user's password.
 * Called from the reset-password callback page after the user clicks the email link.
 */
export async function updatePassword(
  formData: FormData
): Promise<ApiResponse<null>> {
  const password = formData.get('password') as string

  if (!password || password.length < 8) {
    return {
      success: false,
      error: 'Password must be at least 8 characters',
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: null }
}

/**
 * Resend the verification email for a teacher who hasn't confirmed yet.
 * Uses Supabase Auth resend method for email verification.
 */
export async function resendVerificationEmail(
  formData: FormData
): Promise<ApiResponse<{ sent: boolean }>> {
  const email = formData.get('email') as string

  if (!email) {
    return { success: false, error: 'Email is required' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: platformUrl('/auth/callback') },
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: { sent: true } }
}
