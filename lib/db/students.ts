// =============================================================================
// lib/db/students.ts — Student CRUD queries (service layer)
// All database queries for students go through this file.
// =============================================================================

import { createAdminClient } from '@/supabase/server'

// -----------------------------------------------------------------------------
// Row types (mirrors the students table from 001_initial_schema.sql)
// These will be replaced by auto-generated types once `npx supabase gen types`
// is run. Until then, we define them manually.
// -----------------------------------------------------------------------------

export type StudentRow = {
  id: string
  supabase_auth_id: string | null
  name: string
  phone: string
  email: string
  pending_email: string | null
  parent_name: string | null
  parent_phone: string | null
  parent_email: string | null
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export type GuardianInput = {
  parent_name?: string | null
  parent_phone?: string | null
  parent_email?: string | null
}

// Input type for creating a student
export type CreateStudentInput = {
  supabaseAuthId: string
  name: string
  email: string
  phone: string
}

// -----------------------------------------------------------------------------
// getStudentByAuthId — Single student by supabase_auth_id
// -----------------------------------------------------------------------------
export async function getStudentByAuthId(
  authId: string
): Promise<StudentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('supabase_auth_id', authId)
    .single()

  if (error || !data) return null
  return data as StudentRow
}

// -----------------------------------------------------------------------------
// getStudentById — Single student by id
// -----------------------------------------------------------------------------
export async function getStudentById(
  id: string
): Promise<StudentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as StudentRow
}

// -----------------------------------------------------------------------------
// getStudentByEmail — Single student by email (UNIQUE column)
// -----------------------------------------------------------------------------
export async function getStudentByEmail(
  email: string
): Promise<StudentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('email', email)
    .single()

  if (error || !data) return null
  return data as StudentRow
}

// -----------------------------------------------------------------------------
// createStudent — Insert a new student record
// -----------------------------------------------------------------------------
export async function createStudent(
  input: CreateStudentInput
): Promise<StudentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('students')
    .insert({
      supabase_auth_id: input.supabaseAuthId,
      name: input.name,
      email: input.email,
      phone: input.phone,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return data as StudentRow
}

// -----------------------------------------------------------------------------
// updateStudent — Partial update with automatic updated_at
// -----------------------------------------------------------------------------
export async function updateStudent(
  studentId: string,
  updates: Record<string, unknown>
): Promise<StudentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('students')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', studentId)
    .select('*')
    .single()

  if (error || !data) return null
  return data as StudentRow
}

// -----------------------------------------------------------------------------
// updateStudentGuardian — Whitelisted update of guardian/parent contact fields.
// Only parent_name, parent_phone, parent_email are touched; nullable empty
// strings are normalised to NULL so the row matches the "missing" UI state.
// -----------------------------------------------------------------------------
export async function updateStudentGuardian(
  studentId: string,
  input: GuardianInput,
): Promise<StudentRow | null> {
  const supabase = createAdminClient()

  const norm = (v: string | null | undefined): string | null => {
    if (v === undefined) return null
    if (v === null) return null
    const trimmed = v.trim()
    return trimmed.length === 0 ? null : trimmed
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (input.parent_name !== undefined) updates.parent_name = norm(input.parent_name)
  if (input.parent_phone !== undefined) updates.parent_phone = norm(input.parent_phone)
  if (input.parent_email !== undefined) updates.parent_email = norm(input.parent_email)

  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', studentId)
    .select('*')
    .single()

  if (error || !data) return null
  return data as StudentRow
}

// -----------------------------------------------------------------------------
// markStudentLoggedIn — Best-effort write of last_login_at on auth callback.
// Caller wraps in try/catch so login flow never fails on stale write.
// -----------------------------------------------------------------------------
export async function markStudentLoggedIn(studentId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('students')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', studentId)
}
