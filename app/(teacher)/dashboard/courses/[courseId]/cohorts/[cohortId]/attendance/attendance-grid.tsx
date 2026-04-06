'use client'

/**
 * AttendanceGrid — Client Component
 * Interactive checkbox grid for marking attendance per session.
 * Supports both initial marking (bulk upsert) and updates (individual toggle).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useUIContext } from '@/providers/UIProvider'
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
  hasExistingData: boolean
}

export function AttendanceGrid({
  sessionId,
  students,
  existingAttendance,
  editable,
  hasExistingData,
}: AttendanceGridProps) {
  const router = useRouter()
  const { addToast } = useUIContext()
  const [isPending, startTransition] = useTransition()

  // Local state for checkboxes
  const [attendance, setAttendance] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const student of students) {
      initial[student.id] = existingAttendance[student.id] ?? false
    }
    return initial
  })

  function toggleStudent(studentId: string) {
    if (!editable) return
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

  // Handle individual update (when attendance was already marked)
  function handleSingleUpdate(studentId: string, present: boolean) {
    startTransition(async () => {
      const result = await updateAttendanceAction(sessionId, studentId, present)
      if (!result.success) {
        addToast({ type: 'error', message: result.error })
        // Revert local state
        setAttendance((prev) => ({
          ...prev,
          [studentId]: !present,
        }))
        return
      }
      router.refresh()
    })
  }

  // Handle bulk save (initial marking)
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
        addToast({ type: 'error', message: result.error })
        return
      }

      addToast({
        type: 'success',
        message: `Attendance saved for ${result.data.count} student${result.data.count === 1 ? '' : 's'}.`,
      })
      router.refresh()
    })
  }

  // Handle checkbox change — either single update or local toggle
  function handleCheckboxChange(studentId: string) {
    const newValue = !attendance[studentId]
    toggleStudent(studentId)

    // If attendance was already marked and is editable, update individually
    if (hasExistingData && editable) {
      handleSingleUpdate(studentId, newValue)
    }
  }

  const presentCount = Object.values(attendance).filter(Boolean).length

  return (
    <div>
      {/* Select all / none controls */}
      {editable && !hasExistingData && (
        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => toggleAll(true)}
            className="px-2 py-1.5 text-sm font-medium text-primary hover:text-primary/90 transition-colors"
          >
            Select All
          </button>
          <span className="text-xs text-muted-foreground">/</span>
          <button
            type="button"
            onClick={() => toggleAll(false)}
            className="px-2 py-1.5 text-sm font-medium text-primary hover:text-primary/90 transition-colors"
          >
            Deselect All
          </button>
          <span className="ml-auto text-xs text-muted-foreground">
            {presentCount} of {students.length} present
          </span>
        </div>
      )}

      {/* Student checkboxes */}
      <div className="flex flex-col gap-2">
        {students.map((student) => (
          <label
            key={student.id}
            className={`
              flex items-center gap-3 rounded-md px-3 py-2
              ${editable ? 'cursor-pointer hover:bg-background' : 'cursor-default'}
              ${attendance[student.id] ? 'bg-success/5' : ''}
              transition-colors
            `}
          >
            <input
              type="checkbox"
              checked={attendance[student.id] ?? false}
              onChange={() => handleCheckboxChange(student.id)}
              disabled={!editable || isPending}
              className="h-4 w-4 rounded border-border text-primary focus:ring-ring disabled:opacity-50"
            />
            <span className="text-sm text-foreground">{student.name}</span>
            {!editable && hasExistingData && (
              <span className={`ml-auto text-xs ${attendance[student.id] ? 'text-success' : 'text-destructive'}`}>
                {attendance[student.id] ? 'Present' : 'Absent'}
              </span>
            )}
          </label>
        ))}
      </div>

      {/* Save button for initial marking */}
      {editable && !hasExistingData && (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleBulkSave}
            loading={isPending}
          >
            Save Attendance
          </Button>
        </div>
      )}

      {/* Status indicator for existing data */}
      {hasExistingData && editable && (
        <p className="mt-3 text-xs text-muted-foreground">
          Click checkboxes to update individual attendance. Changes save automatically.
        </p>
      )}
    </div>
  )
}
