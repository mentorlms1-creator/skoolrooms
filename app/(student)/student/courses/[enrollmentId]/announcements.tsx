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
import { Paperclip, Pin, MessageCircle } from 'lucide-react'
import sanitizeHtml from 'sanitize-html'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
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
    <div className="flex flex-col gap-5">
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
    <Card className="rounded-[2rem] border-none shadow-sm ring-1 ring-foreground/5 bg-card overflow-hidden">
      <CardContent className="px-8 pt-8 pb-8">
        {/* Header: pinned badge + date */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{teacherName}</span>
            <span className="text-xs text-muted-foreground">
              {formatPKT(announcement.createdAt, 'datetime')}
            </span>
            {announcement.pinned && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                <Pin className="h-3 w-3" />
                Pinned
              </span>
            )}
          </div>
          {!markedRead && (
            <span className="rounded-lg bg-primary text-primary-foreground px-2 py-0.5 text-xs font-bold">
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
          <div className="mt-4">
            <a
              href={announcement.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm text-primary hover:bg-background transition-colors"
            >
              <Paperclip className="h-4 w-4" />
              View Attachment
            </a>
          </div>
        )}

        {/* Comments section */}
        <div className="mt-5 border-t border-foreground/5 pt-4">
          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            className="inline-flex min-h-[2.75rem] items-center gap-1.5 py-2 px-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {announcement.comments.length} comment
            {announcement.comments.length === 1 ? '' : 's'}
            <span className="ml-0.5">{showComments ? '(hide)' : '(show)'}</span>
          </button>

          {showComments && (
            <div className="mt-3 flex flex-col gap-3">
              {/* Existing comments */}
              {announcement.comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`rounded-2xl p-4 ring-1 ring-foreground/[0.03] ${
                    comment.authorType === 'teacher'
                      ? 'bg-primary/5'
                      : 'bg-container'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {comment.authorType === 'teacher'
                        ? teacherName
                        : comment.authorId === studentId
                          ? 'You'
                          : 'Student'}
                    </span>
                    <span className={`rounded-lg px-1.5 py-0.5 text-xs font-medium ${
                      comment.authorType === 'teacher'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {comment.authorType === 'teacher' ? 'Teacher' : 'Student'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatPKT(comment.createdAt, 'relative')}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-foreground">{comment.body}</p>
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
      </CardContent>
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

      toast.success('Comment added.')
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
        className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
      />
      <Button type="submit" size="sm" className="rounded-xl" loading={isPending}>
        Comment
      </Button>
      {error && <p className="self-center text-sm text-destructive">{error}</p>}
    </form>
  )
}
