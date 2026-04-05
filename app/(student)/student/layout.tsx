/**
 * app/(student)/student/layout.tsx — Root layout for all student routes
 *
 * Server Component. Checks auth, fetches student data and enrollments,
 * wraps children in UIProvider > StudentProvider > StudentNav + main content.
 *
 * The middleware rewrites students.lumscribe.com/* to /student/*,
 * so this layout handles all student portal pages.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { getStudentByAuthId } from '@/lib/db/students'
import { getEnrollmentsByStudentWithTeacher } from '@/lib/db/enrollments'
import { UIProvider } from '@/providers/UIProvider'
import { StudentProvider } from '@/providers/StudentProvider'
import type { StudentData, StudentEnrollment } from '@/providers/StudentProvider'
import { StudentNav } from '@/components/student/StudentNav'
import { ROUTES } from '@/constants/routes'

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 1. Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(ROUTES.PLATFORM.studentLogin)

  // 2. Fetch student row
  const student = await getStudentByAuthId(user.id)
  if (!student) redirect(ROUTES.PLATFORM.studentLogin)

  // 3. Fetch enrollments with teacher info
  const enrollments = await getEnrollmentsByStudentWithTeacher(student.id)

  // 4. Map to StudentData shape
  const studentData: StudentData = {
    id: student.id,
    name: student.name,
    email: student.email,
    phone: student.phone,
  }

  // 5. Map enrollments to StudentEnrollment shape
  const studentEnrollments: StudentEnrollment[] = enrollments.map((e) => ({
    id: e.id,
    cohortId: e.cohort_id,
    courseName: e.cohorts.courses.title,
    teacherName: e.cohorts.teachers.name,
    status: e.status as StudentEnrollment['status'],
  }))

  return (
    <UIProvider>
      <StudentProvider student={studentData} enrollments={studentEnrollments}>
        <div className="min-h-dvh bg-paper">
          <StudentNav />
          <main className="mx-auto max-w-6xl p-4 sm:p-6">
            {children}
          </main>
        </div>
      </StudentProvider>
    </UIProvider>
  )
}
