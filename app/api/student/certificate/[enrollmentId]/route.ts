import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { createElement } from 'react'
import { createClient, createAdminClient } from '@/supabase/server'
import { getStudentByAuthId } from '@/lib/db/students'
import { getTeacherByAuthId, getTeacherById } from '@/lib/db/teachers'
import { getCertificateByEnrollmentId } from '@/lib/db/certificates'
import { formatPKT } from '@/lib/time/pkt'
import { CertificateDocument } from '@/components/teacher/CertificateDocument'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> },
) {
  const { enrollmentId } = await params

  const supabaseClient = await createClient()
  const {
    data: { user },
  } = await supabaseClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  type EnrollmentForCert = {
    id: string
    student_id: string
    status: string
    students: { id: string; name: string }
    cohorts: {
      id: string
      name: string
      start_date: string
      end_date: string
      teacher_id: string
      courses: { id: string; title: string }
    }
  }

  const { data: rawEnrollment, error: enrollError } = await supabase
    .from('enrollments')
    .select(`
      id, student_id, status,
      students!inner(id, name),
      cohorts!inner(
        id, name, start_date, end_date, teacher_id,
        courses!inner(id, title)
      )
    `)
    .eq('id', enrollmentId)
    .single()

  if (enrollError || !rawEnrollment) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  const enrollment = rawEnrollment as unknown as EnrollmentForCert

  // Dual-mode auth: student owner OR teacher who owns the cohort.
  const student = await getStudentByAuthId(user.id)
  let authorized = false
  if (student && student.id === enrollment.student_id) {
    authorized = true
  } else {
    const teacher = await getTeacherByAuthId(user.id)
    if (teacher && teacher.id === enrollment.cohorts.teacher_id) {
      authorized = true
    }
  }
  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cert = await getCertificateByEnrollmentId(enrollmentId)
  if (!cert) {
    return NextResponse.json({ error: 'Certificate not issued' }, { status: 404 })
  }
  if (cert.revoked_at) {
    return NextResponse.json({ error: 'Certificate has been revoked.' }, { status: 403 })
  }

  const teacherRow = await getTeacherById(enrollment.cohorts.teacher_id)
  const teacherName = teacherRow?.name ?? 'Skool Rooms'

  const startDate = formatPKT(enrollment.cohorts.start_date, 'date')
  const endDate = formatPKT(enrollment.cohorts.end_date, 'date')
  const issuedDate = formatPKT(cert.issued_at, 'date')

  const pdfElement = createElement(CertificateDocument, {
    studentName: enrollment.students.name,
    cohortName: enrollment.cohorts.name,
    courseName: enrollment.cohorts.courses.title,
    teacherName,
    startDate,
    endDate,
    issuedDate,
    certificateNumber: cert.certificate_number,
  })

  const pdfBuffer = await renderToBuffer(pdfElement as unknown as ReactElement<DocumentProps>)

  const safeStudentName = enrollment.students.name.replace(/[^a-zA-Z0-9]/g, '-')
  const safeCohortName = enrollment.cohorts.name.replace(/[^a-zA-Z0-9]/g, '-')

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="certificate-${safeStudentName}-${safeCohortName}.pdf"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
