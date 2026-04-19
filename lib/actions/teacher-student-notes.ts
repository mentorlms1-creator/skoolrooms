'use server'

import { revalidatePath } from 'next/cache'
import { requireTeacher } from '@/lib/auth/guards'
import { checkPlanLock, getPlanLockError } from '@/lib/auth/plan-guard'
import { getEnrollmentsByStudentForTeacher } from '@/lib/db/enrollments'
import {
  createNote,
  deleteNote,
  listNotesForStudent,
  updateNote,
  type TeacherStudentNoteRow,
} from '@/lib/db/teacher-student-notes'
import type { ApiResponse } from '@/types/api'

const MAX_NOTE_LENGTH = 4000

async function ensureTeacherCanSeeStudent(teacherId: string, studentId: string): Promise<boolean> {
  const enrollments = await getEnrollmentsByStudentForTeacher(studentId, teacherId)
  return enrollments.length > 0
}

export async function listNotesForStudentAction(
  studentId: string,
  cohortId?: string | null,
): Promise<ApiResponse<TeacherStudentNoteRow[]>> {
  const teacher = await requireTeacher()
  const allowed = await ensureTeacherCanSeeStudent(teacher.id, studentId)
  if (!allowed) {
    return { success: false, error: 'Student not visible to you', code: 'FORBIDDEN' }
  }

  const notes = await listNotesForStudent(teacher.id, studentId, cohortId ?? null)
  return { success: true, data: notes }
}

export async function createNoteAction(
  studentId: string,
  body: string,
  cohortId?: string | null,
): Promise<ApiResponse<TeacherStudentNoteRow>> {
  const teacher = await requireTeacher()

  if (checkPlanLock(teacher)) return getPlanLockError()

  const trimmed = body.trim()
  if (trimmed.length === 0) return { success: false, error: 'Note cannot be empty' }
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return { success: false, error: `Note must be ${MAX_NOTE_LENGTH} characters or fewer` }
  }

  const allowed = await ensureTeacherCanSeeStudent(teacher.id, studentId)
  if (!allowed) {
    return { success: false, error: 'Student not visible to you', code: 'FORBIDDEN' }
  }

  const note = await createNote(teacher.id, studentId, trimmed, cohortId ?? null)
  if (!note) return { success: false, error: 'Failed to save note' }

  revalidatePath(`/dashboard/students/${studentId}`)
  return { success: true, data: note }
}

export async function updateNoteAction(
  noteId: string,
  studentId: string,
  body: string,
): Promise<ApiResponse<TeacherStudentNoteRow>> {
  const teacher = await requireTeacher()

  if (checkPlanLock(teacher)) return getPlanLockError()

  const trimmed = body.trim()
  if (trimmed.length === 0) return { success: false, error: 'Note cannot be empty' }
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return { success: false, error: `Note must be ${MAX_NOTE_LENGTH} characters or fewer` }
  }

  const note = await updateNote(teacher.id, noteId, trimmed)
  if (!note) return { success: false, error: 'Note not found', code: 'NOT_FOUND' }

  revalidatePath(`/dashboard/students/${studentId}`)
  return { success: true, data: note }
}

export async function deleteNoteAction(
  noteId: string,
  studentId: string,
): Promise<ApiResponse<null>> {
  const teacher = await requireTeacher()

  const ok = await deleteNote(teacher.id, noteId)
  if (!ok) return { success: false, error: 'Failed to delete note' }

  revalidatePath(`/dashboard/students/${studentId}`)
  return { success: true, data: null }
}
