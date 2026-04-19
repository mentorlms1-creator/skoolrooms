/**
 * app/(student)/student/layout.tsx — Root layout for all student routes
 *
 * Server Component. Checks auth, fetches student data and enrollments,
 * wraps children in UIProvider > StudentProvider > StudentNav + main content.
 *
 * The middleware rewrites students.skoolrooms.com/* to /student/*,
 * so this layout handles all student portal pages.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { getStudentByAuthId } from '@/lib/db/students'
import { getEnrollmentsByStudentWithTeacher } from '@/lib/db/enrollments'
import { UIProvider } from '@/providers/UIProvider'
import { StudentProvider } from '@/providers/StudentProvider'
import type { StudentData, StudentEnrollment } from '@/providers/StudentProvider'
import { SidebarShell } from '@/components/ui/SidebarShell'
import { ROUTES } from '@/constants/routes'
import { signOutStudent } from '@/lib/auth/actions'
import { NotificationBell } from '@/components/ui/NotificationBell'
import { getUnreadCountForUser, getNotificationsForUser } from '@/lib/db/notifications'
import { getUnreadCountForStudent } from '@/lib/db/messages'

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

  // 3. Fetch enrollments, notification data in parallel
  const [enrollments, unreadNotifCount, notifications, unreadMsgCount] = await Promise.all([
    getEnrollmentsByStudentWithTeacher(student.id),
    getUnreadCountForUser(student.id, 'student'),
    getNotificationsForUser(student.id, 'student'),
    getUnreadCountForStudent(student.id),
  ])

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
        <SidebarShell
          role="student"
          user={{ name: studentData.name }}
          notificationCount={unreadMsgCount}
          notificationHref={ROUTES.STUDENT.messages}
          notificationSlot={
            <NotificationBell
              initialCount={unreadNotifCount}
              initialNotifications={notifications}
              userId={student.id}
              userType="student"
            />
          }
          signOutAction={signOutStudent}
        >
          {children}
        </SidebarShell>
      </StudentProvider>
    </UIProvider>
  )
}
