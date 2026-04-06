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
import { FileText, Clock, CheckCircle2, Paperclip, Upload } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { FileUpload } from '@/components/ui/FileUpload'
import { toast } from 'sonner'
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
    <div className="flex flex-col gap-5">
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
    <Card className="rounded-[2rem] border-none shadow-sm ring-1 ring-foreground/5 bg-card overflow-hidden">
      <CardContent className="px-8 pt-8 pb-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
              <FileText className="h-5 w-5 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground">{assignment.title}</h3>
              <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Due: {formatPKT(assignment.dueDate, 'datetime')}</span>
                {isPastDue && !hasSubmission && (
                  <span className="ml-2 text-destructive font-medium">Overdue</span>
                )}
              </div>
            </div>
          </div>
          <StatusBadge status={submissionLabel} size="sm" />
        </div>

        {/* Description */}
        <p className="mt-4 text-sm text-foreground whitespace-pre-wrap">
          {assignment.description}
        </p>

        {/* Assignment file attachment */}
        {assignment.fileUrl && (
          <div className="mt-4">
            <a
              href={assignment.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm text-primary hover:bg-background transition-colors"
            >
              <Paperclip className="h-4 w-4" />
              Assignment File
            </a>
          </div>
        )}

        {/* Existing submission info */}
        {hasSubmission && (
          <div className="mt-5 rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <p className="text-sm font-semibold text-foreground">Your Submission</p>
              </div>
              <span className="text-xs text-muted-foreground">
                Submitted: {formatPKT(assignment.submission!.submittedAt, 'datetime')}
              </span>
            </div>
            {assignment.submission!.textAnswer && (
              <p className="mt-3 text-sm text-foreground whitespace-pre-wrap">
                {assignment.submission!.textAnswer}
              </p>
            )}
            {assignment.submission!.fileUrl && (
              <a
                href={assignment.submission!.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/90"
              >
                <Paperclip className="h-3.5 w-3.5" />
                View submitted file
              </a>
            )}
            {isReviewed && (
              <p className="mt-3 text-xs text-success">
                Reviewed by teacher on{' '}
                {formatPKT(assignment.submission!.reviewedAt!, 'datetime')}
              </p>
            )}
          </div>
        )}

        {/* Submit / Re-submit button */}
        {canSubmit && !isReviewed && (
          <div className="mt-5">
            {!showSubmitForm ? (
              <Button
                variant="secondary"
                size="sm"
                className="rounded-xl"
                onClick={() => setShowSubmitForm(true)}
              >
                <Upload className="mr-1.5 h-4 w-4" />
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
      </CardContent>
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

      toast.success('Assignment submitted successfully.')
      onCancel()
      router.refresh()
    })
  }

  return (
    <div className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-5">
      <h4 className="mb-4 text-sm font-semibold text-foreground">
        {existingSubmission ? 'Re-submit Assignment' : 'Submit Assignment'}
      </h4>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="text-answer" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
          Text Answer
        </Label>
        <Textarea
          id="text-answer"
          value={textAnswer}
          onChange={(e) => setTextAnswer(e.target.value)}
          placeholder="Type your answer here..."
          rows={4}
        />
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
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

      <div className="mt-5 flex gap-2">
        <Button
          type="button"
          className="rounded-xl"
          onClick={handleSubmit}
          loading={isPending}
        >
          {existingSubmission ? 'Re-submit' : 'Submit'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="rounded-xl"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
