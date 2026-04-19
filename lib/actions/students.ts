'use server'

import { revalidatePath } from 'next/cache'
import { requireStudent, requireTeacher } from '@/lib/auth/guards'
import { getEnrollmentsByStudentForTeacher } from '@/lib/db/enrollments'
import { getStudentByAuthId, updateStudentGuardian, type StudentRow } from '@/lib/db/students'
import type { ApiResponse } from '@/types/api'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_EMAIL_LEN = 254
const MAX_NAME_LEN = 120
const MAX_PHONE_LEN = 32

type GuardianFormInput = {
  parent_name?: string | null
  parent_phone?: string | null
  parent_email?: string | null
}

function validateGuardianInput(input: GuardianFormInput): string | null {
  if (input.parent_name && input.parent_name.length > MAX_NAME_LEN) {
    return 'Guardian name is too long'
  }
  if (input.parent_phone && input.parent_phone.length > MAX_PHONE_LEN) {
    return 'Guardian phone is too long'
  }
  if (input.parent_email) {
    const trimmed = input.parent_email.trim()
    if (trimmed.length > MAX_EMAIL_LEN) return 'Email is too long'
    if (trimmed.length > 0 && !EMAIL_RE.test(trimmed)) return 'Enter a valid email address'
  }
  return null
}

export async function updateStudentGuardianAsTeacher(
  studentId: string,
  input: GuardianFormInput,
): Promise<ApiResponse<StudentRow>> {
  const teacher = await requireTeacher()

  const enrollments = await getEnrollmentsByStudentForTeacher(studentId, teacher.id)
  if (enrollments.length === 0) {
    return { success: false, error: 'Student not visible to you', code: 'FORBIDDEN' }
  }

  const validationError = validateGuardianInput(input)
  if (validationError) return { success: false, error: validationError }

  const updated = await updateStudentGuardian(studentId, input)
  if (!updated) return { success: false, error: 'Failed to update guardian contact' }

  revalidatePath(`/dashboard/students/${studentId}`)
  return { success: true, data: updated }
}

export async function updateOwnGuardianContact(
  input: GuardianFormInput,
): Promise<ApiResponse<StudentRow>> {
  const student = await requireStudent()
  // requireStudent reads the row; the auth lookup also works as a defence-in-depth check.
  const fresh = await getStudentByAuthId(student.supabase_auth_id as string)
  if (!fresh) return { success: false, error: 'Student account not found' }

  const validationError = validateGuardianInput(input)
  if (validationError) return { success: false, error: validationError }

  const updated = await updateStudentGuardian(fresh.id, input)
  if (!updated) return { success: false, error: 'Failed to update guardian contact' }

  revalidatePath('/student/settings')
  return { success: true, data: updated }
}
