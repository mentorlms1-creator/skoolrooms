'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Save, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formatPKT } from '@/lib/time/pkt'
import {
  createNoteAction,
  deleteNoteAction,
  updateNoteAction,
} from '@/lib/actions/teacher-student-notes'
import type { TeacherStudentNoteRow } from '@/lib/db/teacher-student-notes'

const MAX = 4000

type CohortOption = {
  id: string
  name: string
  courseTitle: string
}

type Props = {
  studentId: string
  initialNotes: TeacherStudentNoteRow[]
  cohortOptions: CohortOption[]
}

export function NotesSection({ studentId, initialNotes, cohortOptions }: Props) {
  const router = useRouter()
  const [notes, setNotes] = useState<TeacherStudentNoteRow[]>(initialNotes)
  const [body, setBody] = useState('')
  const [scope, setScope] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const trimmed = body.trim()
    if (trimmed.length === 0) return
    startTransition(async () => {
      const cohortId = scope === 'all' ? null : scope
      const result = await createNoteAction(studentId, trimmed, cohortId)
      if (!result.success) {
        setError(result.error)
        return
      }
      setNotes((prev) => [result.data, ...prev])
      setBody('')
      setScope('all')
      router.refresh()
    })
  }

  function handleDelete(noteId: string) {
    startTransition(async () => {
      const result = await deleteNoteAction(noteId, studentId)
      if (!result.success) {
        setError(result.error)
        return
      }
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
      router.refresh()
    })
  }

  function handleEdit(noteId: string, newBody: string) {
    startTransition(async () => {
      const result = await updateNoteAction(noteId, studentId, newBody)
      if (!result.success) {
        setError(result.error)
        return
      }
      setNotes((prev) => prev.map((n) => (n.id === noteId ? result.data : n)))
      router.refresh()
    })
  }

  return (
    <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
      <CardHeader className="px-8 pt-8 pb-4">
        <CardTitle className="text-xl font-bold">Private notes</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Visible only to you. Students never see these.
        </p>
      </CardHeader>
      <CardContent className="px-8 pb-8 space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <form onSubmit={handleAdd} className="space-y-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX}
            rows={3}
            placeholder="Add a private note about this student..."
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Scope</span>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="h-8 min-w-[180px] text-xs">
                  <SelectValue placeholder="All cohorts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cohorts</SelectItem>
                  {cohortOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.courseTitle} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {body.length}/{MAX}
              </span>
              <Button type="submit" size="sm" loading={pending} disabled={body.trim().length === 0}>
                Add note
              </Button>
            </div>
          </div>
        </form>

        <div className="space-y-3">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                cohortOptions={cohortOptions}
                onDelete={() => handleDelete(note.id)}
                onEdit={(newBody) => handleEdit(note.id, newBody)}
                pending={pending}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function NoteCard({
  note,
  cohortOptions,
  onDelete,
  onEdit,
  pending,
}: {
  note: TeacherStudentNoteRow
  cohortOptions: CohortOption[]
  onDelete: () => void
  onEdit: (newBody: string) => void
  pending: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.body)
  const cohort = cohortOptions.find((c) => c.id === note.cohort_id)

  return (
    <div className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-4 space-y-2">
      {editing ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX}
          rows={3}
        />
      ) : (
        <p className="text-sm text-foreground whitespace-pre-wrap">{note.body}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="text-xs text-muted-foreground">
          {formatPKT(note.created_at, 'relative')}
          {cohort && (
            <>
              {' '}· <span className="text-foreground/70">{cohort.courseTitle} — {cohort.name}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(note.body)
                  setEditing(false)
                }}
                disabled={pending}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onEdit(draft)
                  setEditing(false)
                }}
                disabled={pending || draft.trim().length === 0}
              >
                <Save className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={pending}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" disabled={pending}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
