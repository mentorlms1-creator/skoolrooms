/**
 * app/(teacher)/dashboard/students/[studentId]/page.tsx — Student detail page
 *
 * Server Component. Hero (identity + KPI strip), guardian strip, enrollments,
 * and notes — all full-width. Mirrors the iCloud-style list page hero.
 */

import type { Metadata } from 'next'
import { Link } from 'next-view-transitions'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  BookOpen,
  CreditCard,
  Users as GuardianIcon,
} from 'lucide-react'
import { requireTeacher } from '@/lib/auth/guards'
import { getStudentById } from '@/lib/db/students'
import { getEnrollmentsByStudentForTeacher } from '@/lib/db/enrollments'
import { getLatestPaymentsByEnrollmentIds } from '@/lib/db/student-payments'
import { getTeacherBalance } from '@/lib/db/balances'
import { listNotesForStudent } from '@/lib/db/teacher-student-notes'
import { StudentAvatar } from '@/components/ui/StudentAvatar'
import { GuardianEditDialog } from './GuardianEditDialog'
import { NotesSection } from './NotesSection'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ROUTES } from '@/constants/routes'
import { formatPKT } from '@/lib/time/pkt'
import {
  StudentRowActions,
  type RowPayment,
} from '../../courses/[courseId]/cohorts/[cohortId]/students/StudentRowActions'

export const metadata: Metadata = {
  title: 'Student Detail — Skool Rooms',
}

export default async function TeacherStudentDetailPage(
  props: { params: Promise<{ studentId: string }> }
) {
  const params = await props.params
  const teacher = await requireTeacher()
  const student = await getStudentById(params.studentId)

  if (!student) {
    notFound()
  }

  const enrollments = await getEnrollmentsByStudentForTeacher(student.id, teacher.id)

  // If this student has no enrollments under this teacher, they shouldn't be accessible
  if (enrollments.length === 0) {
    notFound()
  }

  const activeEnrollmentIds = enrollments
    .filter((e) => e.status === 'active')
    .map((e) => e.id)
  const [balance, fullPayments, notes] = await Promise.all([
    getTeacherBalance(teacher.id),
    getLatestPaymentsByEnrollmentIds(activeEnrollmentIds),
    listNotesForStudent(teacher.id, student.id),
  ])

  const cohortOptions = enrollments.map((e) => ({
    id: e.cohorts.id,
    name: e.cohorts.name,
    courseTitle: e.cohorts.courses.title,
  }))
  const slimPaymentByEnrollment = new Map<string, RowPayment>()
  for (const [enrollmentId, p] of fullPayments) {
    slimPaymentByEnrollment.set(enrollmentId, {
      id: p.id,
      amount_pkr: p.amount_pkr,
      teacher_payout_amount_pkr: p.teacher_payout_amount_pkr,
      platform_cut_pkr: p.platform_cut_pkr,
      payment_method: p.payment_method,
      refunded_at: p.refunded_at,
      status: p.status,
      screenshot_url: p.screenshot_url,
    })
  }

  const activeCount = enrollments.filter(
    (e) => e.status === 'active' || e.status === 'enrolled',
  ).length
  const pendingCount = enrollments.filter((e) => e.status === 'pending').length

  const hasGuardian =
    !!student.parent_name || !!student.parent_phone || !!student.parent_email

  return (
    <>
      {/* Back link */}
      <Link
        href={ROUTES.TEACHER.students}
        className="mb-4 flex items-center justify-center rounded-xl p-2.5 min-h-[44px] min-w-[44px] w-fit text-muted-foreground bg-card shadow-sm ring-1 ring-foreground/5 hover:text-foreground transition-all"
        aria-label="Back to students"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </Link>

      {/* Hero — identity on left, KPI strip on right */}
      <div className="mb-5 rounded-2xl bg-card ring-1 ring-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Identity block */}
          <div className="flex items-start gap-4 min-w-0">
            <StudentAvatar
              id={student.id}
              name={student.name}
              photoUrl={student.profile_photo_url ?? null}
              size="lg"
            />
            <div className="min-w-0">
              <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-none text-foreground truncate">
                {student.name}
              </h1>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground truncate">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{student.email}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground/80">
                {student.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {student.phone}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Joined {formatPKT(student.created_at, 'date')}
                </span>
              </div>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-0 lg:min-w-[320px]">
            <KpiStat value={enrollments.length} label="Total" tone="neutral" />
            <KpiStat value={activeCount} label="Active" tone="success" divided />
            <KpiStat value={pendingCount} label="Pending" tone="warning" divided />
          </div>
        </div>
      </div>

      {/* Guardian compact strip */}
      <div className="mb-5 rounded-2xl bg-card ring-1 ring-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/60">
              <GuardianIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Guardian
              </p>
              {hasGuardian ? (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {student.parent_name && (
                    <span className="font-medium text-foreground">
                      {student.parent_name}
                    </span>
                  )}
                  {student.parent_phone && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {student.parent_phone}
                    </span>
                  )}
                  {student.parent_email && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {student.parent_email}
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  No guardian contact added.
                </p>
              )}
            </div>
          </div>
          <GuardianEditDialog
            studentId={student.id}
            defaults={{
              parent_name: student.parent_name,
              parent_phone: student.parent_phone,
              parent_email: student.parent_email,
            }}
          />
        </div>
      </div>

      {/* Enrollments — full width */}
      <Card className="mb-5 border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
        <CardHeader className="px-6 sm:px-8 pt-6 sm:pt-8 pb-3">
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
            Enrollments
            <span className="ml-1 text-sm font-medium text-muted-foreground">
              ({enrollments.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 sm:px-8 pb-6 sm:pb-8">
          <div className="space-y-2.5">
            {enrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    href={ROUTES.TEACHER.cohortStudents(
                      enrollment.cohorts.courses.id,
                      enrollment.cohorts.id
                    )}
                    className="min-w-0 flex-1 transition-opacity hover:opacity-80"
                  >
                    <p className="text-[15px] font-semibold text-foreground truncate">
                      {enrollment.cohorts.courses.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{enrollment.cohorts.name}</span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatPKT(enrollment.created_at, 'date')}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        PKR {enrollment.cohorts.fee_pkr.toLocaleString()}
                        <span className="text-muted-foreground/70">
                          {enrollment.cohorts.fee_type === 'one_time' ? '· One-time' : '· Monthly'}
                        </span>
                      </span>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={enrollment.status} size="sm" />
                    {enrollment.status === 'active' && (
                      <StudentRowActions
                        enrollmentId={enrollment.id}
                        studentName={student.name}
                        enrollmentStatus={enrollment.status}
                        payment={slimPaymentByEnrollment.get(enrollment.id) ?? null}
                        availableBalance={balance.available_balance_pkr}
                        cohortArchived={enrollment.cohorts.status === 'archived'}
                        hasPendingWithdrawal={!!enrollment.withdrawal_requested_at}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes — full width */}
      <NotesSection
        studentId={student.id}
        initialNotes={notes}
        cohortOptions={cohortOptions}
      />
    </>
  )
}

type KpiTone = 'neutral' | 'success' | 'warning'

function KpiStat({
  value,
  label,
  tone,
  divided = false,
}: {
  value: number
  label: string
  tone: KpiTone
  divided?: boolean
}) {
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : 'text-foreground'

  return (
    <div className={divided ? 'pl-4 sm:pl-6 border-l border-border/40' : 'pr-4 sm:pr-6'}>
      <div
        className={`text-[26px] sm:text-[34px] font-semibold tracking-[-0.025em] leading-none ${toneClass}`}
      >
        {value}
      </div>
      <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
    </div>
  )
}
