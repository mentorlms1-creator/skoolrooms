// =============================================================================
// lib/db/certificates.ts — Certificates CRUD queries (service layer)
// =============================================================================

import { createAdminClient } from '@/supabase/server'

export interface CertificateRow {
  id: string
  enrollment_id: string
  certificate_number: string
  issued_at: string
  issued_by_teacher_id: string | null
  revoked_at: string | null
  revoke_reason: string | null
  created_at: string
}

export async function getCertificateByEnrollmentId(
  enrollmentId: string,
): Promise<CertificateRow | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .maybeSingle()
  if (error || !data) return null
  return data as CertificateRow
}

export async function getCertificateByNumber(
  certificateNumber: string,
): Promise<CertificateRow | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('certificate_number', certificateNumber)
    .maybeSingle()
  if (error || !data) return null
  return data as CertificateRow
}

export async function createCertificate(input: {
  enrollmentId: string
  certificateNumber: string
  issuedByTeacherId: string | null
}): Promise<CertificateRow> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('certificates')
    .insert({
      enrollment_id: input.enrollmentId,
      certificate_number: input.certificateNumber,
      issued_by_teacher_id: input.issuedByTeacherId,
    })
    .select('*')
    .single()
  if (error || !data) {
    throw error ?? new Error('Failed to create certificate')
  }
  return data as CertificateRow
}

export async function updateCertificateRevoked(
  id: string,
  revokeReason: string | null,
  revokedAt: Date | null,
): Promise<CertificateRow | null> {
  const supabase = createAdminClient()
  const update: Record<string, unknown> = {
    revoked_at: revokedAt ? revokedAt.toISOString() : null,
    revoke_reason: revokeReason,
  }
  // Re-issue path bumps issued_at so the cert reads as freshly issued.
  if (revokedAt === null) {
    update.issued_at = new Date().toISOString()
  }
  const { data, error } = await supabase
    .from('certificates')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()
  if (error || !data) return null
  return data as CertificateRow
}

export async function getCertificatesByEnrollmentIds(
  enrollmentIds: string[],
): Promise<Map<string, CertificateRow>> {
  const map = new Map<string, CertificateRow>()
  if (enrollmentIds.length === 0) return map
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .in('enrollment_id', enrollmentIds)
  if (error || !data) return map
  for (const row of data as CertificateRow[]) {
    map.set(row.enrollment_id, row)
  }
  return map
}

export async function getRecentlyIssuedCertificatesForStudent(
  studentId: string,
  sinceDays = 30,
): Promise<Array<CertificateRow & { enrollment: { id: string; cohort_id: string }; cohort: { id: string; name: string }; course: { title: string } }>> {
  const supabase = createAdminClient()
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('certificates')
    .select(`
      *,
      enrollments!inner(
        id, cohort_id, student_id,
        cohorts!inner(
          id, name,
          courses!inner(title)
        )
      )
    `)
    .gte('issued_at', since)
    .is('revoked_at', null)
    .eq('enrollments.student_id', studentId)
    .order('issued_at', { ascending: false })

  if (error || !data) return []

  type Joined = CertificateRow & {
    enrollments: {
      id: string
      cohort_id: string
      cohorts: {
        id: string
        name: string
        courses: { title: string }
      }
    }
  }

  return (data as Joined[]).map((row) => ({
    ...row,
    enrollment: { id: row.enrollments.id, cohort_id: row.enrollments.cohort_id },
    cohort: { id: row.enrollments.cohorts.id, name: row.enrollments.cohorts.name },
    course: { title: row.enrollments.cohorts.courses.title },
  }))
}
