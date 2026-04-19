/**
 * app/(teacher)/dashboard/students/[studentId]/page.tsx — Student detail page
 *
 * Server Component. Shows student profile info and all their enrollments
 * that belong to this teacher's cohorts.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { User, Mail, Phone, Calendar, BookOpen, CreditCard, Users as GuardianIcon } from 'lucide-react'
import { requireTeacher } from '@/lib/auth/guards'
import { getStudentById } from '@/lib/db/students'
import { getEnrollmentsByStudentForTeacher } from '@/lib/db/enrollments'
import { getLatestPaymentsByEnrollmentIds } from '@/lib/db/student-payments'
import { getTeacherBalance } from '@/lib/db/balances'
import { listNotesForStudent } from '@/lib/db/teacher-student-notes'
import { PageHeader } from '@/components/ui/PageHeader'
import { GuardianEditDialog } from './GuardianEditDialog'
import { NotesSection } from './NotesSection'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ROUTES } from '@/constants/routes'
import { formatPKT } from '@/lib/time/pkt'
import {
  StudentRowActions,
  type RowPayment,
} from '../../courses/[courseId]/cohorts/[cohortId]/students/StudentRowActions'

export const metadata: Metadata = {
  title: 'Student Detail \u2014 Skool Rooms',
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

  // Fetch balance + latest payment per active enrollment for refund eligibility.
  // Project a slim shape to avoid shipping every payment column to the client.
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

  return (
    <>
      <PageHeader
        title={student.name}
        description={student.email}
        backHref={ROUTES.TEACHER.students}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left column — Enrollments */}
        <div className="space-y-5 lg:col-span-2">
          <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
            <CardHeader className="px-8 pt-8 pb-4">
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                Enrollments
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="space-y-3">
                {enrollments.map((enrollment) => (
                  <div
                    key={enrollment.id}
                    className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <Link
                        href={ROUTES.TEACHER.cohortStudents(
                          enrollment.cohorts.courses.id,
                          enrollment.cohorts.id
                        )}
                        className="min-w-0 flex-1 transition-opacity hover:opacity-80"
                      >
                        <p className="text-[15px] font-bold text-foreground">
                          {enrollment.cohorts.courses.title}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {enrollment.cohorts.name}
                        </p>
                      </Link>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={enrollment.status} size="sm" />
                        {enrollment.status === 'active' && (
                          <StudentRowActions
                            enrollmentId={enrollment.id}
                            studentName={student.name}
                            payment={slimPaymentByEnrollment.get(enrollment.id) ?? null}
                            availableBalance={balance.available_balance_pkr}
                            cohortArchived={enrollment.cohorts.status === 'archived'}
                            hasPendingWithdrawal={!!enrollment.withdrawal_requested_at}
                          />
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatPKT(enrollment.created_at, 'date')}
                      </span>
                      <span className="flex items-center gap-1">
                        <CreditCard className="h-3.5 w-3.5" />
                        PKR {enrollment.cohorts.fee_pkr.toLocaleString()}
                        <span className="capitalize">({enrollment.cohorts.fee_type})</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column — Profile */}
        <div className="space-y-5">
          <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
            <CardHeader className="px-8 pt-8 pb-4">
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <User className="h-5 w-5 text-muted-foreground" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="space-y-3">
                <InfoItem
                  icon={<User className="h-4 w-4 text-muted-foreground" />}
                  label="Name"
                  value={student.name}
                />
                <InfoItem
                  icon={<Mail className="h-4 w-4 text-muted-foreground" />}
                  label="Email"
                  value={student.email}
                />
                <InfoItem
                  icon={<Phone className="h-4 w-4 text-muted-foreground" />}
                  label="Phone"
                  value={student.phone}
                />
                <InfoItem
                  icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
                  label="Member Since"
                  value={formatPKT(student.created_at, 'date')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Guardian */}
          <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
            <CardHeader className="px-8 pt-8 pb-4">
              <CardTitle className="flex items-center justify-between gap-2 text-xl font-bold">
                <span className="flex items-center gap-2">
                  <GuardianIcon className="h-5 w-5 text-muted-foreground" />
                  Guardian
                </span>
                <GuardianEditDialog
                  studentId={student.id}
                  defaults={{
                    parent_name: student.parent_name,
                    parent_phone: student.parent_phone,
                    parent_email: student.parent_email,
                  }}
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="space-y-3">
                <InfoItem
                  icon={<User className="h-4 w-4 text-muted-foreground" />}
                  label="Name"
                  value={student.parent_name ?? '—'}
                />
                <InfoItem
                  icon={<Phone className="h-4 w-4 text-muted-foreground" />}
                  label="Phone"
                  value={student.parent_phone ?? '—'}
                />
                <InfoItem
                  icon={<Mail className="h-4 w-4 text-muted-foreground" />}
                  label="Email"
                  value={student.parent_email ?? '—'}
                />
              </div>
            </CardContent>
          </Card>

          {/* Quick stats */}
          <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
            <CardHeader className="px-8 pt-8 pb-4">
              <CardTitle className="text-xl font-bold">Summary</CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="space-y-3">
                <InfoItem
                  icon={<BookOpen className="h-4 w-4 text-muted-foreground" />}
                  label="Total Enrollments"
                  value={String(enrollments.length)}
                />
                <InfoItem
                  icon={<BookOpen className="h-4 w-4 text-primary" />}
                  label="Active"
                  value={String(enrollments.filter((e) => e.status === 'active' || e.status === 'enrolled').length)}
                />
                <InfoItem
                  icon={<BookOpen className="h-4 w-4 text-warning" />}
                  label="Pending"
                  value={String(enrollments.filter((e) => e.status === 'pending').length)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <NotesSection
          studentId={student.id}
          initialNotes={notes}
          cohortOptions={cohortOptions}
        />
      </div>
    </>
  )
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-4">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-[15px] font-bold text-foreground">{value}</dd>
    </div>
  )
}
