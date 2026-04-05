'use client'

/**
 * AnnouncementList — Client Component
 * Renders announcement cards with:
 * - Sanitized HTML body
 * - Pinned badge
 * - File attachment link
 * - Seen-by indicator with expandable student list
 * - Pin/unpin and delete action buttons
 * - Comment thread with add/delete capability
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import sanitizeHtml from 'sanitize-html'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useUIContext } from '@/providers/UIProvider'
import { formatPKT } from '@/lib/time/pkt'
import {
  pinAnnouncementAction,
  deleteAnnouncementAction,
  createCommentAction,
  deleteCommentAction,
} from '@/lib/actions/announcements'

type CommentData = {
  id: string
  authorId: string
  authorType: 'teacher' | 'student'
  authorName: string
  body: string
  createdAt: string
}

type AnnouncementData = {
  id: string
  body: string
  fileUrl: string | null
  pinned: boolean
  createdAt: string
  seenByCount: number
  totalStudents: number
  readStudentNames: string[]
  comments: CommentData[]
}

type AnnouncementListProps = {
  announcements: AnnouncementData[]
  teacherName: string
  isArchived: boolean
}

export function AnnouncementList({
  announcements,
  teacherName,
  isArchived,
}: AnnouncementListProps) {
  return (
    <div className="flex flex-col gap-4">
      {announcements.map((announcement) => (
        <AnnouncementCard
          key={announcement.id}
          announcement={announcement}
          teacherName={teacherName}
          isArchived={isArchived}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AnnouncementCard
// ---------------------------------------------------------------------------

function AnnouncementCard({
  announcement,
  teacherName,
  isArchived,
}: {
  announcement: AnnouncementData
  teacherName: string
  isArchived: boolean
}) {
  const router = useRouter()
  const { addToast, confirm } = useUIContext()
  const [isPending, startTransition] = useTransition()
  const [showSeenList, setShowSeenList] = useState(false)
  const [showComments, setShowComments] = useState(false)

  function handlePin() {
    startTransition(async () => {
      const result = await pinAnnouncementAction(announcement.id, !announcement.pinned)
      if (!result.success) {
        addToast({ type: 'error', message: result.error })
        return
      }
      addToast({
        type: 'success',
        message: announcement.pinned ? 'Announcement unpinned.' : 'Announcement pinned.',
      })
      router.refresh()
    })
  }

  function handleDelete() {
    confirm({
      title: 'Delete Announcement',
      message:
        'Are you sure you want to delete this announcement? This action cannot be undone.',
      confirmText: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        startTransition(async () => {
          const result = await deleteAnnouncementAction(announcement.id)
          if (!result.success) {
            addToast({ type: 'error', message: result.error })
            return
          }
          addToast({ type: 'success', message: 'Announcement deleted.' })
          router.refresh()
        })
      },
    })
  }

  const sanitizedBody = sanitizeHtml(announcement.body)

  return (
    <Card className="p-6">
      {/* Header: pinned badge + date + actions */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">{teacherName}</span>
          <span className="text-xs text-muted">
            {formatPKT(announcement.createdAt, 'datetime')}
          </span>
          {announcement.pinned && <StatusBadge status="pinned" size="sm" />}
        </div>
        {!isArchived && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePin}
              disabled={isPending}
            >
              {announcement.pinned ? 'Unpin' : 'Pin'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
              className="text-danger hover:text-danger"
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Body (sanitized HTML) */}
      <div
        className="prose prose-sm max-w-none overflow-x-auto text-ink"
        dangerouslySetInnerHTML={{ __html: sanitizedBody }}
      />

      {/* File attachment */}
      {announcement.fileUrl && (
        <div className="mt-3">
          <a
            href={announcement.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-brand-600 hover:bg-paper transition-colors"
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

      {/* Seen by indicator */}
      <div className="mt-4 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setShowSeenList(!showSeenList)}
          className="min-h-[2.75rem] py-2 px-1 text-xs text-muted hover:text-ink transition-colors"
        >
          Seen by {announcement.seenByCount} of {announcement.totalStudents} student
          {announcement.totalStudents === 1 ? '' : 's'}
          {announcement.readStudentNames.length > 0 && (
            <span className="ml-1">{showSeenList ? '(hide)' : '(show)'}</span>
          )}
        </button>
        {showSeenList && announcement.readStudentNames.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {announcement.readStudentNames.map((name) => (
              <li
                key={name}
                className="rounded-full bg-paper px-2.5 py-0.5 text-xs text-muted"
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Comments section */}
      <div className="mt-3 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setShowComments(!showComments)}
          className="min-h-[2.75rem] py-2 px-1 text-xs font-medium text-muted hover:text-ink transition-colors"
        >
          {announcement.comments.length} comment
          {announcement.comments.length === 1 ? '' : 's'}
          <span className="ml-1">{showComments ? '(hide)' : '(show)'}</span>
        </button>

        {showComments && (
          <div className="mt-3 flex flex-col gap-3">
            {/* Existing comments */}
            {announcement.comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                isArchived={isArchived}
              />
            ))}

            {/* Add comment form */}
            {!isArchived && (
              <CommentForm announcementId={announcement.id} />
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// CommentItem
// ---------------------------------------------------------------------------

function CommentItem({
  comment,
  isArchived,
}: {
  comment: CommentData
  isArchived: boolean
}) {
  const router = useRouter()
  const { addToast, confirm } = useUIContext()
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    confirm({
      title: 'Delete Comment',
      message: 'Are you sure you want to delete this comment?',
      confirmText: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        startTransition(async () => {
          const result = await deleteCommentAction(comment.id)
          if (!result.success) {
            addToast({ type: 'error', message: result.error })
            return
          }
          addToast({ type: 'success', message: 'Comment deleted.' })
          router.refresh()
        })
      },
    })
  }

  return (
    <div className="flex items-start justify-between gap-2 rounded-md bg-paper p-3">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">{comment.authorName}</span>
          <span className="rounded-full bg-surface px-1.5 py-0.5 text-xs text-muted">
            {comment.authorType === 'teacher' ? 'Teacher' : 'Student'}
          </span>
          <span className="text-xs text-muted">
            {formatPKT(comment.createdAt, 'relative')}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink">{comment.body}</p>
      </div>
      {/* Teacher can delete any comment (moderation) */}
      {!isArchived && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isPending}
          className="shrink-0 text-danger hover:text-danger"
        >
          Delete
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CommentForm
// ---------------------------------------------------------------------------

function CommentForm({ announcementId }: { announcementId: string }) {
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
        className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
      />
      <Button type="submit" size="sm" loading={isPending}>
        Comment
      </Button>
      {error && <p className="self-center text-sm text-danger">{error}</p>}
    </form>
  )
}
