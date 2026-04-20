// =============================================================================
// app/(teacher)/dashboard/messages/page.tsx — Teacher messages list
// =============================================================================

import Link from 'next/link'
import { PenSquare } from 'lucide-react'
import { requireTeacher } from '@/lib/auth/guards'
import { getThreadsForTeacherWithNames } from '@/lib/db/messages'
import { ThreadList } from '@/components/messaging/ThreadList'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'

export default async function TeacherMessagesPage() {
  const teacher = await requireTeacher()
  const teacherId = teacher.id as string

  const threads = await getThreadsForTeacherWithNames(teacherId)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Messages</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Direct messages with your students.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={ROUTES.TEACHER.messagesNew}>
            <PenSquare className="mr-1.5 h-4 w-4" />
            New message
          </Link>
        </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <ThreadList
          threads={threads}
          baseHref={ROUTES.TEACHER.messages}
        />
      </div>
    </div>
  )
}
