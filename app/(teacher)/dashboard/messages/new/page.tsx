// =============================================================================
// app/(teacher)/dashboard/messages/new/page.tsx — Start a new message
// =============================================================================

import { Link } from 'next-view-transitions'
import { ArrowLeft } from 'lucide-react'
import { requireTeacher } from '@/lib/auth/guards'
import { searchTeacherStudents } from '@/lib/db/enrollments'
import { NewMessageSearch } from '@/components/messaging/NewMessageSearch'
import { ROUTES } from '@/constants/routes'

export default async function NewMessagePage() {
  const teacher = await requireTeacher()
  const teacherId = teacher.id as string

  const students = await searchTeacherStudents({ teacherId, limit: 50 })

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href={ROUTES.TEACHER.messages}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to messages
        </Link>
        <h1 className="text-2xl font-bold text-foreground">New message</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a student from your cohorts to start a conversation.
        </p>
      </div>

      <NewMessageSearch students={students} />
    </div>
  )
}
