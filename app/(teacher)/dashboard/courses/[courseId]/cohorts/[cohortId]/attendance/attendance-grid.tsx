'use client'

/**
 * AttendanceGrid — Client Component
 * Interactive checkbox grid for marking attendance per session.
 * - Fresh session: bulk-save all checkboxes at once.
 * - Within 24h of initial marking: checkboxes toggle and save individually.
 * - Past 24h window: every toggle opens a reason modal; edit is logged to
 *   attendance_edits. Cohort being archived is the only hard lock.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  markAttendanceAction,
  updateAttendanceAction,
} from '@/lib/actions/attendance'

type StudentData = {
  id: string
  name: string
}

type AttendanceGridProps = {
  sessionId: string
  students: StudentData[]
  existingAttendance: Record<string, boolean>
  editable: boolean
  pastEditWindow?: boolean
  hasExistingData: boolean
}

type PendingEdit = {
  studentId: string
  studentName: string
  nextPresent: boolean
}

export function AttendanceGrid({
  sessionId,
  students,
  existingAttendance,
  editable,
  pastEditWindow = false,
  hasExistingData,
}: AttendanceGridProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [attendance, setAttendance] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const student of students) {
      initial[student.id] = existingAttendance[student.id] ?? false
    }
    return initial
  })

  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null)
  const [reason, setReason] = useState('')

  const canInteract = editable || pastEditWindow

  function toggleStudent(studentId: string) {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }))
  }

  function toggleAll(present: boolean) {
    if (!editable) return
    const updated: Record<string, boolean> = {}
    for (const student of students) {
      updated[student.id] = present
    }
    setAttendance(updated)
  }

  function handleSingleUpdate(studentId: string, present: boolean, editReason?: string) {
    startTransition(async () => {
      const result = await updateAttendanceAction(sessionId, studentId, present, editReason)
      if (!result.success) {
        toast.error(result.error)
        setAttendance((prev) => ({
          ...prev,
          [studentId]: !present,
        }))
        return
      }
      if (editReason) {
        toast.success('Attendance updated. Edit logged.')
      }
      router.refresh()
    })
  }

  function handleBulkSave() {
    startTransition(async () => {
      const records = students.map((s) => ({
        studentId: s.id,
        present: attendance[s.id] ?? false,
      }))

      const formData = new FormData()
      formData.set('session_id', sessionId)
      formData.set('students', JSON.stringify(records))

      const result = await markAttendanceAction(formData)

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(`Attendance saved for ${result.data.count} student${result.data.count === 1 ? '' : 's'}.`)
      router.refresh()
    })
  }

  function handleCheckboxChange(studentId: string) {
    const newValue = !attendance[studentId]

    // Past 24h window: intercept, ask for reason first.
    if (pastEditWindow && hasExistingData) {
      const student = students.find((s) => s.id === studentId)
      if (!student) return
      setPendingEdit({ studentId, studentName: student.name, nextPresent: newValue })
      setReason('')
      return
    }

    toggleStudent(studentId)

    if (hasExistingData && editable) {
      handleSingleUpdate(studentId, newValue)
    }
  }

  function confirmPendingEdit() {
    if (!pendingEdit) return
    const trimmed = reason.trim()
    if (trimmed.length < 3) {
      toast.error('Please give a short reason (at least 3 characters).')
      return
    }
    const { studentId, nextPresent } = pendingEdit
    setAttendance((prev) => ({ ...prev, [studentId]: nextPresent }))
    setPendingEdit(null)
    handleSingleUpdate(studentId, nextPresent, trimmed)
  }

  const presentCount = Object.values(attendance).filter(Boolean).length

  return (
    <>
      <div className="rounded-[2rem] border-none shadow-sm ring-1 ring-foreground/5 bg-card overflow-hidden">
        <div className="p-5">
          {editable && !hasExistingData && (
            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleAll(true)}
                className="rounded-xl px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
              >
                Select All
              </button>
              <span className="text-xs text-muted-foreground">/</span>
              <button
                type="button"
                onClick={() => toggleAll(false)}
                className="rounded-xl px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
              >
                Deselect All
              </button>
              <span className="ml-auto text-xs text-muted-foreground">
                {presentCount} of {students.length} present
              </span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            {students.map((student) => (
              <label
                key={student.id}
                className={`
                  flex items-center gap-3 rounded-xl px-4 py-2.5
                  ${canInteract ? 'cursor-pointer hover:bg-container' : 'cursor-default'}
                  ${attendance[student.id] ? 'bg-success/5' : ''}
                  transition-colors
                `}
              >
                <input
                  type="checkbox"
                  checked={attendance[student.id] ?? false}
                  onChange={() => handleCheckboxChange(student.id)}
                  disabled={!canInteract || isPending}
                  className="h-4 w-4 rounded border-border accent-primary text-primary focus:ring-ring disabled:opacity-50"
                />
                <span className="text-sm font-medium text-foreground">{student.name}</span>
                {!canInteract && hasExistingData && (
                  <span className={`ml-auto text-xs font-medium ${attendance[student.id] ? 'text-success' : 'text-destructive'}`}>
                    {attendance[student.id] ? 'Present' : 'Absent'}
                  </span>
                )}
              </label>
            ))}
          </div>

          {editable && !hasExistingData && (
            <div className="mt-5 flex justify-end">
              <Button
                onClick={handleBulkSave}
                loading={isPending}
                className="rounded-xl"
              >
                Save Attendance
              </Button>
            </div>
          )}

          {hasExistingData && editable && !pastEditWindow && (
            <p className="mt-3 text-xs text-muted-foreground">
              Click checkboxes to update individual attendance. Changes save automatically.
            </p>
          )}

          {pastEditWindow && (
            <p className="mt-3 text-xs text-muted-foreground">
              This attendance was saved more than 24 hours ago. Toggling a checkbox will ask for a reason; the change is logged.
            </p>
          )}
        </div>
      </div>

      <AlertDialog open={!!pendingEdit} onOpenChange={(v) => { if (!v) setPendingEdit(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit attendance for {pendingEdit?.studentName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Marking as <strong>{pendingEdit?.nextPresent ? 'Present' : 'Absent'}</strong>. Please give a short reason — this edit will be logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 pb-2">
            <Label htmlFor="attendance-edit-reason" className="text-xs font-medium text-foreground">
              Reason
            </Label>
            <Textarea
              id="attendance-edit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. marked wrong student by mistake"
              rows={3}
              maxLength={1000}
              disabled={isPending}
              className="mt-1.5"
            />
          </div>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setPendingEdit(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={confirmPendingEdit} disabled={isPending || reason.trim().length < 3} loading={isPending}>
              Save edit
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
