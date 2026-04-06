'use client'

/**
 * Assignment list — Client Component
 * Displays assignment cards with submission details and review actions.
 * Handles delete + review server actions.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useUIContext } from '@/providers/UIProvider'
import sanitizeHtml from 'sanitize-html'
import { deleteAssignmentAction, reviewSubmissionAction } from '@/lib/actions/assignments'
import { formatPKT } from '@/lib/time/pkt'

type Submission = {
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  textAnswer: string | null
  fileUrl: string | null
  submittedAt: string
  reviewedAt: string | null
  status: string
}

type Assignment = {
  id: string
  title: string
  description: string
  fileUrl: string | null
  dueDate: string
  createdAt: string
  submissionCount: number
  submittedCount: number
  reviewedCount: number
  overdueCount: number
  submissions: Submission[]
}

type AssignmentListProps = {
  assignments: Assignment[]
  isArchived: boolean
}

export function AssignmentList({ assignments, isArchived }: AssignmentListProps) {
  const router = useRouter()
  const { addToast } = useUIContext()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleExpanded(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  function handleDelete(assignmentId: string) {
    if (!confirm('Are you sure you want to delete this assignment?')) return

    setDeletingId(assignmentId)
    startTransition(async () => {
      const result = await deleteAssignmentAction(assignmentId)
      setDeletingId(null)

      if (!result.success) {
        addToast({ type: 'error', message: result.error })
        return
      }

      addToast({ type: 'success', message: 'Assignment deleted.' })
      router.refresh()
    })
  }

  function handleReview(submissionId: string) {
    setReviewingId(submissionId)
    startTransition(async () => {
      const result = await reviewSubmissionAction(submissionId)
      setReviewingId(null)

      if (!result.success) {
        addToast({ type: 'error', message: result.error })
        return
      }

      addToast({ type: 'success', message: 'Submission marked as reviewed.' })
      router.refresh()
    })
  }

  const isPastDue = (dueDate: string) => new Date(dueDate) < new Date()

  return (
    <div className="flex flex-col gap-4">
      {assignments.map((assignment) => {
        const isExpanded = expandedId === assignment.id
        const pastDue = isPastDue(assignment.dueDate)

        return (
          <Card key={assignment.id} className="overflow-hidden">
            {/* Assignment header */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleExpanded(assignment.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleExpanded(assignment.id)
                }
              }}
              className="flex w-full cursor-pointer items-start justify-between gap-4 p-4 text-left hover:bg-background transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{assignment.title}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>Due: {formatPKT(assignment.dueDate, 'datetime')}</span>
                  {pastDue && <StatusBadge status="overdue" size="sm" />}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{assignment.submissionCount} submission{assignment.submissionCount !== 1 ? 's' : ''}</span>
                  <span>{assignment.reviewedCount} reviewed</span>
                  {assignment.overdueCount > 0 && (
                    <span className="text-destructive">{assignment.overdueCount} overdue</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!isArchived && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(assignment.id)
                    }}
                    loading={deletingId === assignment.id}
                    disabled={isPending}
                  >
                    Delete
                  </Button>
                )}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`h-5 w-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>

            {/* Expanded section: description + submissions */}
            {isExpanded && (
              <div className="border-t border-border">
                {/* Description */}
                <div className="px-4 py-3 border-b border-border">
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
                  <div
                    className="prose prose-sm max-w-none overflow-x-auto text-foreground"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(assignment.description) }}
                  />
                  {assignment.fileUrl && (
                    <a
                      href={assignment.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      View Attachment
                    </a>
                  )}
                </div>

                {/* Submissions table */}
                <div className="px-4 py-3">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">
                    Submissions ({assignment.submissionCount})
                  </h4>
                  {assignment.submissions.length > 0 ? (
                    <>
                      {/* Mobile card view */}
                      <div className="md:hidden flex flex-col gap-3">
                        {assignment.submissions.map((sub) => (
                          <div key={sub.id} className="rounded-md border border-border p-3 sm:p-4 text-sm">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-foreground">{sub.studentName}</p>
                                <p className="text-xs text-muted-foreground">{sub.studentEmail}</p>
                              </div>
                              <StatusBadge status={sub.status} size="sm" />
                            </div>
                            <p className="mt-2 text-muted-foreground">
                              {formatPKT(sub.submittedAt, 'datetime')}
                            </p>
                            <div className="mt-2 flex items-center justify-between">
                              <span>
                                {sub.fileUrl ? (
                                  <a
                                    href={sub.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    View File
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground">No file</span>
                                )}
                              </span>
                              {sub.status !== 'reviewed' ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleReview(sub.id)}
                                  loading={reviewingId === sub.id}
                                  disabled={isPending}
                                >
                                  Review
                                </Button>
                              ) : (
                                <span className="text-sm text-success">Reviewed</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Desktop table view */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-left text-muted-foreground">
                              <th className="pb-2 pr-4 font-medium">Student</th>
                              <th className="pb-2 pr-4 font-medium">Submitted</th>
                              <th className="pb-2 pr-4 font-medium">Status</th>
                              <th className="pb-2 pr-4 font-medium">File</th>
                              <th className="pb-2 font-medium">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assignment.submissions.map((sub) => (
                              <tr key={sub.id} className="border-b border-border last:border-0">
                                <td className="py-2 pr-4">
                                  <div className="font-medium text-foreground">{sub.studentName}</div>
                                  <div className="text-xs text-muted-foreground">{sub.studentEmail}</div>
                                </td>
                                <td className="py-2 pr-4 text-muted-foreground">
                                  {formatPKT(sub.submittedAt, 'datetime')}
                                </td>
                                <td className="py-2 pr-4">
                                  <StatusBadge status={sub.status} size="sm" />
                                </td>
                                <td className="py-2 pr-4">
                                  {sub.fileUrl ? (
                                    <a
                                      href={sub.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline"
                                    >
                                      View
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">--</span>
                                  )}
                                </td>
                                <td className="py-2">
                                  {sub.status !== 'reviewed' ? (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => handleReview(sub.id)}
                                      loading={reviewingId === sub.id}
                                      disabled={isPending}
                                    >
                                      Review
                                    </Button>
                                  ) : (
                                    <span className="text-sm text-success">Reviewed</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No submissions yet.</p>
                  )}
                </div>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
