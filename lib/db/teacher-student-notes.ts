// =============================================================================
// lib/db/teacher-student-notes.ts — Private per-student notes (service layer).
// Always scoped by teacher_id; admin client is used so RLS does not interfere
// with server-side aggregations, but every helper still re-checks ownership.
// =============================================================================

import { createAdminClient } from '@/supabase/server'

export type TeacherStudentNoteRow = {
  id: string
  teacher_id: string
  student_id: string
  cohort_id: string | null
  body: string
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// listNotesForStudent — All notes a teacher has written for a student.
// Optional cohort filter narrows to notes scoped to one cohort.
// -----------------------------------------------------------------------------
export async function listNotesForStudent(
  teacherId: string,
  studentId: string,
  cohortId?: string | null,
): Promise<TeacherStudentNoteRow[]> {
  const supabase = createAdminClient()

  let query = supabase
    .from('teacher_student_notes')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (cohortId) {
    query = query.eq('cohort_id', cohortId)
  }

  const { data, error } = await query
  if (error || !data) return []
  return data as TeacherStudentNoteRow[]
}

// -----------------------------------------------------------------------------
// createNote — Insert a new note. body is trimmed by the caller.
// -----------------------------------------------------------------------------
export async function createNote(
  teacherId: string,
  studentId: string,
  body: string,
  cohortId?: string | null,
): Promise<TeacherStudentNoteRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teacher_student_notes')
    .insert({
      teacher_id: teacherId,
      student_id: studentId,
      cohort_id: cohortId ?? null,
      body,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return data as TeacherStudentNoteRow
}

// -----------------------------------------------------------------------------
// updateNote — Replace body, bumps updated_at. Verifies ownership in WHERE.
// -----------------------------------------------------------------------------
export async function updateNote(
  teacherId: string,
  noteId: string,
  body: string,
): Promise<TeacherStudentNoteRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teacher_student_notes')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('teacher_id', teacherId)
    .select('*')
    .single()

  if (error || !data) return null
  return data as TeacherStudentNoteRow
}

// -----------------------------------------------------------------------------
// deleteNote — Hard delete. Verifies ownership in WHERE.
// -----------------------------------------------------------------------------
export async function deleteNote(teacherId: string, noteId: string): Promise<boolean> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('teacher_student_notes')
    .delete()
    .eq('id', noteId)
    .eq('teacher_id', teacherId)

  return !error
}
