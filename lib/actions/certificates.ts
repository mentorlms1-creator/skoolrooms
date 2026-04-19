'use server'

// =============================================================================
// lib/actions/certificates.ts — Server actions for certificate issuance,
// revocation, and bulk-issue.
// =============================================================================

import { createClient, createAdminClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { getStudentById } from '@/lib/db/students'
import {
  getEnrollmentById,
  getCompletedEnrollmentsByCohort,
} from '@/lib/db/enrollments'
import { getCohortById } from '@/lib/db/cohorts'
import {
  createCertificate,
  getCertificateByEnrollmentId,
  getCertificatesByEnrollmentIds,
  updateCertificateRevoked,
  type CertificateRow,
} from '@/lib/db/certificates'
import { generateCertificateNumber } from '@/lib/certificates/generateNumber'
import { checkPlanLock, getPlanLockError } from '@/lib/auth/plan-guard'
import { sendEmail } from '@/lib/email/sender'
import type { ApiResponse } from '@/types/api'

async function getAuthenticatedTeacher() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return getTeacherByAuthId(user.id)
}

async function insertCertificateWithRetry(
  enrollmentId: string,
  issuedByTeacherId: string,
  attempts = 5,
): Promise<CertificateRow> {
  let lastError: unknown = null
  for (let i = 0; i < attempts; i++) {
    const certificateNumber = generateCertificateNumber()
    try {
      return await createCertificate({
        enrollmentId,
        certificateNumber,
        issuedByTeacherId,
      })
    } catch (err) {
      lastError = err
      // PG unique_violation = 23505. The supabase-js error has a code field.
      const code = (err as { code?: string } | null)?.code
      if (code !== '23505') throw err
    }
  }
  throw lastError ?? new Error('Failed to generate unique certificate number')
}

// -----------------------------------------------------------------------------
// issueCertificateAction — manually issue (or re-issue) a single certificate
// -----------------------------------------------------------------------------
export async function issueCertificateAction(
  enrollmentId: string,
): Promise<ApiResponse<{ certificateId: string; certificateNumber: string }>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }
  if (checkPlanLock(teacher)) return getPlanLockError()

  const enrollment = await getEnrollmentById(enrollmentId)
  if (!enrollment) return { success: false, error: 'Enrollment not found' }

  const cohort = await getCohortById(enrollment.cohort_id)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Enrollment not found' }
  }

  if (enrollment.status !== 'completed') {
    return {
      success: false,
      error: 'Mark the student complete first.',
      code: 'NOT_COMPLETED',
    }
  }

  const existing = await getCertificateByEnrollmentId(enrollmentId)
  let cert: CertificateRow

  if (existing && !existing.revoked_at) {
    return {
      success: false,
      error: 'Certificate already issued.',
      code: 'ALREADY_ISSUED',
    }
  }

  if (existing && existing.revoked_at) {
    const reissued = await updateCertificateRevoked(existing.id, null, null)
    if (!reissued) {
      return { success: false, error: 'Failed to re-issue certificate.' }
    }
    cert = reissued
  } else {
    try {
      cert = await insertCertificateWithRetry(enrollmentId, teacher.id)
    } catch (err) {
      console.error('[issueCertificateAction] insert failed', err)
      return {
        success: false,
        error: 'Could not generate certificate number, please retry.',
      }
    }
  }

  const student = await getStudentById(enrollment.student_id)
  const courseTitle = await getCourseTitleForCohort(cohort.id)
  if (student) {
    await sendEmail({
      to: student.email,
      type: 'certificate_issued',
      recipientId: student.id,
      recipientType: 'student',
      data: {
        studentName: student.name,
        teacherName: teacher.name,
        cohortName: cohort.name,
        courseName: courseTitle ?? '',
        certificateNumber: cert.certificate_number,
      },
    })
  }

  return {
    success: true,
    data: { certificateId: cert.id, certificateNumber: cert.certificate_number },
  }
}

// -----------------------------------------------------------------------------
// revokeCertificateAction — revoke an issued certificate
// No email sent: revocation is a private teacher decision.
// -----------------------------------------------------------------------------
export async function revokeCertificateAction(
  certificateId: string,
  reason: string,
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }
  if (checkPlanLock(teacher)) return getPlanLockError()

  const supabase = createAdminClient()
  const { data: certData, error: certErr } = await supabase
    .from('certificates')
    .select('id, enrollment_id, revoked_at')
    .eq('id', certificateId)
    .single()
  if (certErr || !certData) {
    return { success: false, error: 'Certificate not found' }
  }
  const cert = certData as { id: string; enrollment_id: string; revoked_at: string | null }
  if (cert.revoked_at) {
    return { success: false, error: 'Certificate already revoked' }
  }

  const enrollment = await getEnrollmentById(cert.enrollment_id)
  if (!enrollment) return { success: false, error: 'Enrollment not found' }
  const cohort = await getCohortById(enrollment.cohort_id)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Certificate not found' }
  }

  const updated = await updateCertificateRevoked(
    cert.id,
    reason.trim() || 'Revoked by teacher',
    new Date(),
  )
  if (!updated) {
    return { success: false, error: 'Failed to revoke certificate.' }
  }

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// bulkIssueCertificatesAction — issue certs for every completed enrollment in
// a cohort that does not already have an active certificate.
// -----------------------------------------------------------------------------
export async function bulkIssueCertificatesAction(
  cohortId: string,
): Promise<ApiResponse<{ issued: number; skipped: number; failed: number }>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }
  if (checkPlanLock(teacher)) return getPlanLockError()

  const cohort = await getCohortById(cohortId)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Cohort not found' }
  }

  const completed = await getCompletedEnrollmentsByCohort(cohortId)
  if (completed.length === 0) {
    return { success: true, data: { issued: 0, skipped: 0, failed: 0 } }
  }

  const certs = await getCertificatesByEnrollmentIds(completed.map((e) => e.id))
  const courseTitle = await getCourseTitleForCohort(cohort.id)

  let issued = 0
  let skipped = 0
  let failed = 0

  for (const enrollment of completed) {
    const existing = certs.get(enrollment.id)
    if (existing && !existing.revoked_at) {
      skipped++
      continue
    }

    try {
      let cert: CertificateRow
      if (existing && existing.revoked_at) {
        const reissued = await updateCertificateRevoked(existing.id, null, null)
        if (!reissued) {
          failed++
          continue
        }
        cert = reissued
      } else {
        cert = await insertCertificateWithRetry(enrollment.id, teacher.id)
      }

      const student = await getStudentById(enrollment.student_id)
      if (student) {
        await sendEmail({
          to: student.email,
          type: 'certificate_issued',
          recipientId: student.id,
          recipientType: 'student',
          data: {
            studentName: student.name,
            teacherName: teacher.name,
            cohortName: cohort.name,
            courseName: courseTitle ?? '',
            certificateNumber: cert.certificate_number,
          },
        })
      }
      issued++
    } catch (err) {
      console.error('[bulkIssueCertificatesAction] failed for', enrollment.id, err)
      failed++
    }
  }

  return { success: true, data: { issued, skipped, failed } }
}

// -----------------------------------------------------------------------------
// revokeCertificateIfAny — internal helper called by enrollment revoke /
// withdrawal-approval paths. Auto-revokes a cert if one exists and is active.
// Caller has already verified ownership.
// -----------------------------------------------------------------------------
export async function revokeCertificateIfAny(
  enrollmentId: string,
  reason: string,
): Promise<void> {
  const cert = await getCertificateByEnrollmentId(enrollmentId)
  if (!cert || cert.revoked_at) return
  await updateCertificateRevoked(cert.id, reason, new Date())
}

async function getCourseTitleForCohort(cohortId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('cohorts')
    .select('courses!inner(title)')
    .eq('id', cohortId)
    .single()
  if (!data) return null
  const row = data as unknown as { courses: { title: string } }
  return row.courses?.title ?? null
}

