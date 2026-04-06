'use client'

/**
 * StudentAssignmentList — Client Component
 * Renders assignment cards from the student perspective:
 * - Title, description, due date
 * - File attachment link
 * - Submission status badge (submitted / overdue / reviewed / not submitted)
 * - Submission form (text answer + file upload)
 * - Re-submission allowed unless reviewed
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Textarea } from '@/components/ui/Textarea'
import { FileUpload } from '@/components/ui/FileUpload'
import { useUIContext } from '@/providers/UIProvider'
import { formatPKT } from '@/lib/time/pkt'
import { submitAssignmentAction } from '@/lib/actions/assignments'

type SubmissionData = {
  id: string
  status: string
  textAnswer: string | null
  fileUrl: string | null
  submittedAt: string
  reviewedAt: string | null
}

type AssignmentData = {
  id: string
  title: string
  description: string
  fileUrl: string | null
  dueDate: string
  createdAt: string
  submission: SubmissionData | null
}

type StudentAssignmentListProps = {
  assignments: AssignmentData[]
  canSubmit: boolean
  studentId: string
}

export function StudentAssignmentList({
  assignments,
  canSubmit,
  studentId,
}: StudentAssignmentListProps) {
  return (
    <div className="flex flex-col gap-4">
      {assignments.map((assignment) => (
        <StudentAssignmentCard
          key={assignment.id}
          assignment={assignment}
          canSubmit={canSubmit}
          studentId={studentId}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StudentAssignmentCard
// ---------------------------------------------------------------------------

function StudentAssignmentCard({
  assignment,
  canSubmit,
  studentId,
}: {
  assignment: AssignmentData
  canSubmit: boolean
  studentId: string
}) {
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const isPastDue = new Date(assignment.dueDate) < new Date()
  const hasSubmission = !!assignment.submission
  const isReviewed = assignment.submission?.status === 'reviewed'

  // Determine submission status label
  let submissionLabel: string
  if (!hasSubmission) {
    submissionLabel = isPastDue ? 'overdue' : 'pending'
  } else {
    submissionLabel = assignment.submission?.status ?? 'submitted'
  }

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-foreground">{assignment.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Due: {formatPKT(assignment.dueDate, 'datetime')}
            {isPastDue && !hasSubmission && (
              <span className="ml-2 text-destructive font-medium">Overdue</span>
            )}
          </p>
        </div>
        <StatusBadge status={submissionLabel} size="sm" />
      </div>

      {/* Description */}
      <p className="mt-3 text-sm text-foreground whitespace-pre-wrap">
        {assignment.description}
      </p>

      {/* Assignment file attachment */}
      {assignment.fileUrl && (
        <div className="mt-3">
          <a
            href={assignment.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-primary hover:bg-background transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
            </svg>
            Assignment File
          </a>
        </div>
      )}

      {/* Existing submission info */}
      {hasSubmission && (
        <div className="mt-4 rounded-md border border-border bg-background p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Your Submission</p>
            <span className="text-xs text-muted-foreground">
              Submitted: {formatPKT(assignment.submission!.submittedAt, 'datetime')}
            </span>
          </div>
          {assignment.submission!.textAnswer && (
            <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
              {assignment.submission!.textAnswer}
            </p>
          )}
          {assignment.submission!.fileUrl && (
            <a
              href={assignment.submission!.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/90"
            >
              View submitted file
            </a>
          )}
          {isReviewed && (
            <p className="mt-2 text-xs text-success">
              Reviewed by teacher on{' '}
              {formatPKT(assignment.submission!.reviewedAt!, 'datetime')}
            </p>
          )}
        </div>
      )}

      {/* Submit / Re-submit button */}
      {canSubmit && !isReviewed && (
        <div className="mt-4">
          {!showSubmitForm ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSubmitForm(true)}
            >
              {hasSubmission ? 'Re-submit' : 'Submit Assignment'}
            </Button>
          ) : (
            <SubmissionForm
              assignmentId={assignment.id}
              studentId={studentId}
              existingSubmission={assignment.submission}
              onCancel={() => setShowSubmitForm(false)}
            />
          )}
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// SubmissionForm
// ---------------------------------------------------------------------------

function SubmissionForm({
  assignmentId,
  studentId,
  existingSubmission,
  onCancel,
}: {
  assignmentId: string
  studentId: string
  existingSubmission: SubmissionData | null
  onCancel: () => void
}) {
  const router = useRouter()
  const { addToast } = useUIContext()
  const [isPending, startTransition] = useTransition()
  const [textAnswer, setTextAnswer] = useState(existingSubmission?.textAnswer ?? '')
  const [fileUrl, setFileUrl] = useState(existingSubmission?.fileUrl ?? '')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    setError(null)
    const trimmedText = textAnswer.trim()

    if (!trimmedText && !fileUrl) {
      setError('Please provide a text answer or upload a file.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('assignment_id', assignmentId)
      if (trimmedText) formData.set('text_answer', trimmedText)
      if (fileUrl) formData.set('file_url', fileUrl)

      const result = await submitAssignmentAction(formData)

      if (!result.success) {
        setError(result.error)
        return
      }

      addToast({ type: 'success', message: 'Assignment submitted successfully.' })
      onCancel()
      router.refresh()
    })
  }

  return (
    <div className="rounded-md border border-border bg-background p-4">
      <h4 className="mb-3 text-sm font-medium text-foreground">
        {existingSubmission ? 'Re-submit Assignment' : 'Submit Assignment'}
      </h4>

      <Textarea
        label="Text Answer"
        value={textAnswer}
        onChange={(e) => setTextAnswer(e.target.value)}
        placeholder="Type your answer here..."
        rows={4}
      />

      <div className="mt-3">
        <p className="mb-1.5 text-sm font-medium text-foreground">
          Or upload a file
        </p>
        <FileUpload
          fileType="submission"
          entityId={studentId}
          onUploadComplete={(url) => setFileUrl(url)}
          currentUrl={fileUrl || undefined}
        />
      </div>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          onClick={handleSubmit}
          loading={isPending}
        >
          {existingSubmission ? 'Re-submit' : 'Submit'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
