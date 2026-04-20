'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MessageSquare } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { startThreadWithStudentAction } from '@/lib/actions/messages'
import { ROUTES } from '@/constants/routes'
import { getInitials } from '@/lib/utils'

export type NewMessageStudent = {
  id: string
  name: string
  email: string
}

type Props = {
  students: NewMessageStudent[]
}

export function NewMessageSearch({ students }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()
  const [openingId, setOpeningId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return students
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q),
    )
  }, [query, students])

  function handlePick(studentId: string) {
    setOpeningId(studentId)
    startTransition(async () => {
      const result = await startThreadWithStudentAction(studentId)
      if (!result.success) {
        toast.error(result.error)
        setOpeningId(null)
        return
      }
      const base = ROUTES.TEACHER.messageThread(result.data.threadId)
      // Brand-new threads have no rows yet — pass the studentId so the
      // thread page can authorise via enrollment instead of by participant lookup.
      const url = result.data.isNew ? `${base}?with=${result.data.studentId}` : base
      router.push(url)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-muted-foreground">No students match</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            You can only message students enrolled in your cohorts.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/40 rounded-2xl border border-border/60 bg-card overflow-hidden">
          {filtered.map((student) => {
            const initials = getInitials(student.name)
            const isOpening = openingId === student.id
            return (
              <li key={student.id}>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handlePick(student.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors disabled:opacity-60"
                >
                  <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-sm font-semibold text-accent flex-shrink-0">
                    {initials || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{student.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {isOpening ? 'Opening…' : 'Message'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
