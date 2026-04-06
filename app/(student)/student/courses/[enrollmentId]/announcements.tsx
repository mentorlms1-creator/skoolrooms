'use client'

/**
 * StudentAnnouncementList — Client Component
 * Renders announcement cards from the student perspective:
 * - Sanitized HTML body
 * - Pinned badge
 * - File attachment link
 * - Mark as read (auto-marks on view)
 * - Comment thread with add capability
 */

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import sanitizeHtml from 'sanitize-html'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useUIContext } from '@/providers/UIProvider'
import { formatPKT } from '@/lib/time/pkt'
import {
  createCommentAction,
  markAnnouncementReadAction,
} from '@/lib/actions/announcements'

type CommentData = {
  id: string
  authorId: string
  authorType: string
  body: string
  createdAt: string
}

type AnnouncementData = {
  id: string
  body: string
  fileUrl: string | null
  pinned: boolean
  createdAt: string
  isRead: boolean
  comments: CommentData[]
}

type StudentAnnouncementListProps = {
  announcements: AnnouncementData[]
  teacherName: string
  isArchived: boolean
  canComment: boolean
  studentId: string
}

export function StudentAnnouncementList({
  announcements,
  teacherName,
  isArchived,
  canComment,
  studentId,
}: StudentAnnouncementListProps) {
  return (
    <div className="flex flex-col gap-4">
      {announcements.map((announcement) => (
        <StudentAnnouncementCard
          key={announcement.id}
          announcement={announcement}
          teacherName={teacherName}
          isArchived={isArchived}
          canComment={canComment}
          studentId={studentId}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StudentAnnouncementCard
// ---------------------------------------------------------------------------

function StudentAnnouncementCard({
  announcement,
  teacherName,
  isArchived,
  canComment,
  studentId,
}: {
  announcement: AnnouncementData
  teacherName: string
  isArchived: boolean
  canComment: boolean
  studentId: string
}) {
  const [isPending, startTransition] = useTransition()
  const [showComments, setShowComments] = useState(false)
  const [markedRead, setMarkedRead] = useState(announcement.isRead)

  // Auto-mark as read when the announcement card mounts (if not already read)
  useEffect(() => {
    if (!markedRead) {
      markAnnouncementReadAction(announcement.id).then((result) => {
        if (result.success) {
          setMarkedRead(true)
        }
      })
    }
  }, [announcement.id, markedRead])

  const sanitizedBody = sanitizeHtml(announcement.body)

  return (
    <Card className="p-6">
      {/* Header: pinned badge + date */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{teacherName}</span>
          <span className="text-xs text-muted-foreground">
            {formatPKT(announcement.createdAt, 'datetime')}
          </span>
          {announcement.pinned && <StatusBadge status="pinned" size="sm" />}
        </div>
        {!markedRead && (
          <span className="rounded-full bg-primary/90 px-2 py-0.5 text-xs font-medium text-white">
            New
          </span>
        )}
      </div>

      {/* Body (sanitized HTML) */}
      <div
        className="prose prose-sm max-w-none overflow-x-auto text-foreground"
        dangerouslySetInnerHTML={{ __html: sanitizedBody }}
      />

      {/* File attachment */}
      {announcement.fileUrl && (
        <div className="mt-3">
          <a
            href={announcement.fileUrl}
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
            View Attachment
          </a>
        </div>
      )}

      {/* Comments section */}
      <div className="mt-4 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setShowComments(!showComments)}
          className="min-h-[2.75rem] py-2 px-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {announcement.comments.length} comment
          {announcement.comments.length === 1 ? '' : 's'}
          <span className="ml-1">{showComments ? '(hide)' : '(show)'}</span>
        </button>

        {showComments && (
          <div className="mt-3 flex flex-col gap-3">
            {/* Existing comments */}
            {announcement.comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-md bg-background p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {comment.authorType === 'teacher'
                      ? teacherName
                      : comment.authorId === studentId
                        ? 'You'
                        : 'Student'}
                  </span>
                  <span className="rounded-full bg-card px-1.5 py-0.5 text-xs text-muted-foreground">
                    {comment.authorType === 'teacher' ? 'Teacher' : 'Student'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatPKT(comment.createdAt, 'relative')}
                  </span>
                </div>
                <p className="mt-1 text-sm text-foreground">{comment.body}</p>
              </div>
            ))}

            {/* Add comment form */}
            {canComment && !isArchived && (
              <StudentCommentForm
                announcementId={announcement.id}
                isPending={isPending}
              />
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// StudentCommentForm
// ---------------------------------------------------------------------------

function StudentCommentForm({
  announcementId,
  isPending: parentPending,
}: {
  announcementId: string
  isPending: boolean
}) {
  const router = useRouter()
  const { addToast } = useUIContext()
  const [isPending, startTransition] = useTransition()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    setError(null)
    const trimmed = body.trim()
    if (!trimmed) {
      setError('Comment cannot be empty.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('announcement_id', announcementId)
      formData.set('body', trimmed)

      const result = await createCommentAction(formData)

      if (!result.success) {
        setError(result.error)
        return
      }

      addToast({ type: 'success', message: 'Comment added.' })
      setBody('')
      router.refresh()
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
      className="flex gap-2"
    >
      <input
        type="text"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a comment..."
        maxLength={2000}
        className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
      />
      <Button type="submit" size="sm" loading={isPending}>
        Comment
      </Button>
      {error && <p className="self-center text-sm text-destructive">{error}</p>}
    </form>
  )
}
