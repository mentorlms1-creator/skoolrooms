'use server'

// =============================================================================
// lib/actions/announcements.ts — Server actions for announcements, comments, reads
// =============================================================================

import { createClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { getStudentByAuthId } from '@/lib/db/students'
import { getCohortById } from '@/lib/db/cohorts'
import {
  getAnnouncementById,
  getCommentById,
  createAnnouncement,
  pinAnnouncement,
  deleteAnnouncement,
  createComment,
  deleteComment,
  markAnnouncementRead,
} from '@/lib/db/announcements'
import { getEnrollmentsByCohort } from '@/lib/db/enrollments'
import { sendEmail } from '@/lib/email/sender'
import { createNotification } from '@/lib/db/notifications'
import { checkPlanLock, getPlanLockError } from '@/lib/auth/plan-guard'
import { ROUTES } from '@/constants/routes'
import type { ApiResponse } from '@/types/api'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function getAuthenticatedTeacher() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  const teacher = await getTeacherByAuthId(user.id)
  return teacher
}

async function getAuthenticatedStudent() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  const student = await getStudentByAuthId(user.id)
  return student
}

// -----------------------------------------------------------------------------
// createAnnouncementAction — Create announcement + send emails to students
// -----------------------------------------------------------------------------

export async function createAnnouncementAction(
  formData: FormData,
): Promise<ApiResponse<{ announcementId: string }>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Hard lock check: block content-write when plan + grace expired
  if (checkPlanLock(teacher)) {
    return getPlanLockError()
  }

  const cohortId = formData.get('cohort_id') as string | null
  const body = (formData.get('body') as string | null)?.trim() ?? ''
  const fileUrl = (formData.get('file_url') as string | null) || undefined

  if (!cohortId) {
    return { success: false, error: 'Cohort is required' }
  }
  if (!body) {
    return { success: false, error: 'Announcement body is required' }
  }
  if (fileUrl && !fileUrl.startsWith('https://')) {
    return { success: false, error: 'File URL must use HTTPS.' }
  }

  // Verify cohort ownership
  const cohort = await getCohortById(cohortId)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Cohort not found' }
  }

  // Archived cohort write guard
  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort is archived. No changes allowed.',
      code: 'COHORT_ARCHIVED',
    }
  }

  const announcement = await createAnnouncement({
    cohortId,
    teacherId: teacher.id,
    body,
    fileUrl,
  })

  if (!announcement) {
    return { success: false, error: 'Failed to create announcement. Please try again.' }
  }

  // Send new_announcement email + in-app notification to enrolled students (non-blocking)
  const enrollments = await getEnrollmentsByCohort(cohortId)
  const activeEnrollments = enrollments.filter((e) => e.status === 'active')

  for (const enrollment of activeEnrollments) {
    void sendEmail({
      to: enrollment.students.email,
      type: 'new_announcement',
      recipientId: enrollment.students.id,
      recipientType: 'student',
      data: {
        studentName: enrollment.students.name,
        teacherName: teacher.name,
        cohortName: cohort.name,
        announcementBody: body.substring(0, 200),
      },
    })
    void createNotification({
      userType: 'student',
      userId: enrollment.students.id,
      kind: 'new_announcement',
      title: `New announcement in ${cohort.name}`,
      body: body.substring(0, 120),
      linkUrl: ROUTES.STUDENT.courses,
    })
  }

  return { success: true, data: { announcementId: announcement.id } }
}

// -----------------------------------------------------------------------------
// pinAnnouncementAction — Toggle pin status
// -----------------------------------------------------------------------------

export async function pinAnnouncementAction(
  announcementId: string,
  pinned: boolean,
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Hard lock check: block content-write when plan + grace expired
  if (checkPlanLock(teacher)) {
    return getPlanLockError()
  }

  // Verify ownership via announcement.teacher_id
  const announcement = await getAnnouncementById(announcementId)
  if (!announcement || announcement.teacher_id !== teacher.id) {
    return { success: false, error: 'Announcement not found' }
  }

  // Archived cohort write guard
  const cohort = await getCohortById(announcement.cohort_id)
  if (!cohort) {
    return { success: false, error: 'Cohort not found' }
  }
  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort is archived. No changes allowed.',
      code: 'COHORT_ARCHIVED',
    }
  }

  const result = await pinAnnouncement(announcementId, teacher.id, pinned)
  if (!result) {
    return { success: false, error: 'Failed to update pin status. Please try again.' }
  }

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// deleteAnnouncementAction — Soft delete
// -----------------------------------------------------------------------------

export async function deleteAnnouncementAction(
  announcementId: string,
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Hard lock check: block content-write when plan + grace expired
  if (checkPlanLock(teacher)) {
    return getPlanLockError()
  }

  // Verify ownership
  const announcement = await getAnnouncementById(announcementId)
  if (!announcement || announcement.teacher_id !== teacher.id) {
    return { success: false, error: 'Announcement not found' }
  }

  // Archived cohort write guard
  const cohort = await getCohortById(announcement.cohort_id)
  if (!cohort) {
    return { success: false, error: 'Cohort not found' }
  }
  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort is archived. No changes allowed.',
      code: 'COHORT_ARCHIVED',
    }
  }

  const success = await deleteAnnouncement(announcementId, teacher.id)
  if (!success) {
    return { success: false, error: 'Failed to delete announcement. Please try again.' }
  }

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// createCommentAction — Add a comment (teacher OR student)
// If student comment → send student_comment email to teacher
// -----------------------------------------------------------------------------

export async function createCommentAction(
  formData: FormData,
): Promise<ApiResponse<{ commentId: string }>> {
  const announcementId = formData.get('announcement_id') as string | null
  const body = (formData.get('body') as string | null)?.trim() ?? ''

  if (!announcementId) {
    return { success: false, error: 'Announcement is required' }
  }
  if (!body) {
    return { success: false, error: 'Comment body is required' }
  }
  if (body.length > 2000) {
    return { success: false, error: 'Comment must be under 2000 characters' }
  }

  // Fetch the announcement to get cohort_id and teacher_id
  const announcement = await getAnnouncementById(announcementId)
  if (!announcement) {
    return { success: false, error: 'Announcement not found' }
  }

  // Archived cohort write guard
  const cohort = await getCohortById(announcement.cohort_id)
  if (!cohort) {
    return { success: false, error: 'Cohort not found' }
  }
  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort is archived. No changes allowed.',
      code: 'COHORT_ARCHIVED',
    }
  }

  // Try teacher auth first
  const teacher = await getAuthenticatedTeacher()
  if (teacher) {
    // Verify teacher owns this announcement's cohort
    if (announcement.teacher_id !== teacher.id) {
      return { success: false, error: 'Announcement not found' }
    }

    const comment = await createComment({
      announcementId,
      authorId: teacher.id,
      authorType: 'teacher',
      body,
    })

    if (!comment) {
      return { success: false, error: 'Failed to add comment. Please try again.' }
    }

    return { success: true, data: { commentId: comment.id } }
  }

  // Try student auth
  const student = await getAuthenticatedStudent()
  if (!student) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify student is enrolled in this cohort
  const enrollments = await getEnrollmentsByCohort(announcement.cohort_id)
  const isEnrolled = enrollments.some(
    (e) => e.student_id === student.id && (e.status === 'active' || e.status === 'pending')
  )

  if (!isEnrolled) {
    return { success: false, error: 'You are not enrolled in this cohort' }
  }

  const comment = await createComment({
    announcementId,
    authorId: student.id,
    authorType: 'student',
    body,
  })

  if (!comment) {
    return { success: false, error: 'Failed to add comment. Please try again.' }
  }

  // Send student_comment email to the teacher (non-blocking)
  // cohort was already fetched above for the archived guard
  const { getTeacherById } = await import('@/lib/db/teachers')
  const announcementTeacher = await getTeacherById(announcement.teacher_id)
  if (announcementTeacher) {
    void sendEmail({
      to: announcementTeacher.email,
      type: 'student_comment',
      recipientId: announcementTeacher.id,
      recipientType: 'teacher',
      data: {
        teacherName: announcementTeacher.name,
        studentName: student.name,
        cohortName: cohort.name,
        commentBody: body.substring(0, 200),
      },
    })
  }

  return { success: true, data: { commentId: comment.id } }
}

// -----------------------------------------------------------------------------
// deleteCommentAction — Teacher moderation delete
// -----------------------------------------------------------------------------

export async function deleteCommentAction(
  commentId: string,
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Fetch the comment to get its announcement_id for archived cohort check
  const comment = await getCommentById(commentId)
  if (!comment) {
    return { success: false, error: 'Comment not found' }
  }

  const announcement = await getAnnouncementById(comment.announcement_id)
  if (!announcement || announcement.teacher_id !== teacher.id) {
    return { success: false, error: 'Announcement not found' }
  }

  // Archived cohort write guard
  const cohort = await getCohortById(announcement.cohort_id)
  if (!cohort) {
    return { success: false, error: 'Cohort not found' }
  }
  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort is archived. No changes allowed.',
      code: 'COHORT_ARCHIVED',
    }
  }

  const success = await deleteComment(commentId, teacher.id)
  if (!success) {
    return { success: false, error: 'Failed to delete comment. Please try again.' }
  }

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// markAnnouncementReadAction — Student marks announcement as read
// -----------------------------------------------------------------------------

export async function markAnnouncementReadAction(
  announcementId: string,
): Promise<ApiResponse<null>> {
  const student = await getAuthenticatedStudent()
  if (!student) {
    return { success: false, error: 'Not authenticated' }
  }

  const success = await markAnnouncementRead(announcementId, student.id)
  if (!success) {
    return { success: false, error: 'Failed to mark as read. Please try again.' }
  }

  return { success: true, data: null }
}
