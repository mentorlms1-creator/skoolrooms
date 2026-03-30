// =============================================================================
// app/api/student/enroll/route.ts
// POST endpoint — student enrollment with atomic slot check via Postgres RPC.
// Requires student auth.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/supabase/server'
import { getStudentByAuthId } from '@/lib/db/students'
import { getCohortById } from '@/lib/db/cohorts'
import {
  checkExistingEnrollment,
  createEnrollment,
  generateReferenceCode,
} from '@/lib/db/enrollments'
import {
  getPaymentByIdempotencyKey,
  createPayment,
} from '@/lib/db/student-payments'
import { PaymentStatus, PaymentMethod } from '@/types/domain'
import type { ApiResponse, EnrollOutput } from '@/types/api'

// -----------------------------------------------------------------------------
// POST /api/student/enroll
// -----------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<EnrollOutput>>> {
  // 1. Auth: check student via session
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 },
    )
  }

  // 2. Fetch student record
  const student = await getStudentByAuthId(user.id)

  if (!student) {
    return NextResponse.json(
      { success: false, error: 'Student profile not found', code: 'STUDENT_NOT_FOUND' },
      { status: 404 },
    )
  }

  // 3. Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const { cohortId, idempotencyKey } = body as {
    cohortId?: string
    idempotencyKey?: string
  }

  if (!cohortId || !idempotencyKey) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: cohortId, idempotencyKey' },
      { status: 400 },
    )
  }

  // 4. Idempotency check: if payment with this key already exists, return existing enrollment
  const existingPayment = await getPaymentByIdempotencyKey(idempotencyKey)

  if (existingPayment) {
    return NextResponse.json({
      success: true,
      data: {
        enrollmentId: existingPayment.enrollment_id,
        referenceCode: existingPayment.reference_code,
        status: 'pending_verification',
      },
    })
  }

  // 5. Check cohort exists and is not archived
  const cohort = await getCohortById(cohortId)

  if (!cohort) {
    return NextResponse.json(
      { success: false, error: 'Cohort not found', code: 'COHORT_NOT_FOUND' },
      { status: 404 },
    )
  }

  if (cohort.status === 'archived') {
    return NextResponse.json(
      { success: false, error: 'This cohort has been archived and is no longer accepting enrollments', code: 'COHORT_ARCHIVED' },
      { status: 403 },
    )
  }

  // 5b. Check registration is open
  if (!cohort.is_registration_open) {
    return NextResponse.json(
      { success: false, error: 'Registration is closed for this cohort', code: 'REGISTRATION_CLOSED' },
      { status: 403 },
    )
  }

  // 6. Check course is published (fetch course via admin client)
  const adminSupabase = createAdminClient()

  const { data: course, error: courseError } = await adminSupabase
    .from('courses')
    .select('status')
    .eq('id', cohort.course_id)
    .is('deleted_at', null)
    .single()

  if (courseError || !course) {
    return NextResponse.json(
      { success: false, error: 'Course not found', code: 'COURSE_NOT_FOUND' },
      { status: 404 },
    )
  }

  if ((course.status as string) !== 'published') {
    return NextResponse.json(
      { success: false, error: 'This course is not yet published', code: 'COURSE_NOT_PUBLISHED' },
      { status: 400 },
    )
  }

  // 7. Check if student is already enrolled in this cohort
  const existingEnrollment = await checkExistingEnrollment(student.id, cohortId)

  if (existingEnrollment) {
    return NextResponse.json(
      { success: false, error: 'You are already enrolled in this cohort', code: 'ALREADY_ENROLLED' },
      { status: 409 },
    )
  }

  // 7b. Check if student was revoked by this teacher (blocked from re-enrolling)
  // Two-step: get teacher's cohort IDs, then check for revoked enrollment
  const { data: teacherCohorts } = await adminSupabase
    .from('cohorts')
    .select('id')
    .eq('teacher_id', cohort.teacher_id)

  const teacherCohortIds = (teacherCohorts || []).map(c => c.id)

  const { data: revokedEnrollment } = teacherCohortIds.length > 0
    ? await adminSupabase
        .from('enrollments')
        .select('id')
        .eq('student_id', student.id)
        .eq('status', 'revoked')
        .in('cohort_id', teacherCohortIds)
        .limit(1)
        .single()
    : { data: null }

  if (revokedEnrollment) {
    return NextResponse.json(
      { success: false, error: 'You are not eligible to enroll with this teacher', code: 'STUDENT_BLOCKED' },
      { status: 403 },
    )
  }

  // 8. Call enroll_student_atomic via Supabase RPC for atomic slot check
  const { data: rpcResult, error: rpcError } = await adminSupabase
    .rpc('enroll_student_atomic', {
      p_cohort_id: cohortId,
      p_student_id: student.id,
    })

  if (rpcError) {
    console.error('[enroll] RPC error:', rpcError.message)
    return NextResponse.json(
      { success: false, error: 'Failed to check enrollment availability' },
      { status: 500 },
    )
  }

  const slotResult = rpcResult as string

  // 9. Handle 'full' result
  if (slotResult === 'full') {
    return NextResponse.json(
      { success: false, error: 'This cohort is full', code: 'COHORT_FULL' },
      { status: 409 },
    )
  }

  // 10. Handle 'waitlisted' result
  if (slotResult === 'waitlisted') {
    // Add to waitlist
    const { error: waitlistError } = await adminSupabase
      .from('cohort_waitlist')
      .insert({
        cohort_id: cohortId,
        student_id: student.id,
        student_name: student.name,
        student_phone: student.phone,
        student_email: student.email,
        status: 'waiting',
      })

    if (waitlistError) {
      // If already on waitlist (unique constraint), treat as success
      if (waitlistError.code === '23505') {
        return NextResponse.json({
          success: true,
          data: {
            enrollmentId: '',
            status: 'waitlisted',
          },
        })
      }

      console.error('[enroll] Waitlist insert error:', waitlistError.message)
      return NextResponse.json(
        { success: false, error: 'Failed to join waitlist' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        enrollmentId: '',
        status: 'waitlisted',
      },
    })
  }

  // 11. Handle 'enrolled' result — create enrollment + payment
  const referenceCode = await generateReferenceCode()

  const enrollment = await createEnrollment({
    studentId: student.id,
    cohortId,
    referenceCode,
  })

  if (!enrollment) {
    console.error('[enroll] Failed to create enrollment')
    return NextResponse.json(
      { success: false, error: 'Failed to create enrollment' },
      { status: 500 },
    )
  }

  // Create student_payments row
  // platform_cut_pkr and teacher_payout_amount_pkr are 0 at enrollment time —
  // they are calculated at APPROVAL time, not enrollment time
  const payment = await createPayment({
    enrollmentId: enrollment.id,
    amountPkr: cohort.fee_pkr,
    discountedAmountPkr: cohort.fee_pkr,
    platformCutPkr: 0,
    teacherPayoutAmountPkr: 0,
    paymentMethod: PaymentMethod.SCREENSHOT,
    referenceCode,
    idempotencyKey,
    status: PaymentStatus.PENDING_VERIFICATION,
  })

  if (!payment) {
    console.error('[enroll] Failed to create payment record')
    return NextResponse.json(
      { success: false, error: 'Failed to create payment record' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      enrollmentId: enrollment.id,
      referenceCode,
      status: 'pending_verification',
    },
  })
}
