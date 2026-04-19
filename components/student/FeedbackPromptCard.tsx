'use client'

/**
 * FeedbackPromptCard — Dismissible feedback prompt shown on student dashboard
 * for each archived cohort with no submitted feedback.
 * Dismissal uses a client-side cookie (30-day TTL).
 */

import { useState, useTransition } from 'react'
import { X, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { submitFeedbackAction } from '@/lib/actions/feedback'

type Props = {
  cohortId: string
  cohortName: string
  courseTitle: string
}

export function FeedbackPromptCard({ cohortId, cohortName, courseTitle }: Props) {
  const [visible, setVisible] = useState(true)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [isPending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function dismiss() {
    // Set 30-day dismissal cookie
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString()
    document.cookie = `dismissed_feedback_${cohortId}=1; expires=${expires}; path=/`
    setVisible(false)
  }

  function handleSubmit() {
    if (!rating) return
    setError(null)
    startTransition(async () => {
      const result = await submitFeedbackAction(cohortId, rating, comment || undefined)
      if (result.success) {
        setSubmitted(true)
        setTimeout(() => setVisible(false), 1500)
      } else {
        if (result.code === 'ALREADY_SUBMITTED') {
          setVisible(false)
        } else {
          setError(result.error ?? 'Failed to submit feedback.')
        }
      }
    })
  }

  if (!visible) return null

  if (submitted) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="px-5 py-4">
          <p className="text-sm text-success font-medium">
            Thanks for your feedback on {cohortName}!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              How was <span className="font-semibold">{courseTitle}</span>?
            </p>
            <p className="text-xs text-muted-foreground">{cohortName}</p>

            {/* Star rating */}
            <div className="mt-3 flex gap-1" role="group" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  className="focus:outline-none"
                  aria-label={`${star} star`}
                >
                  <Star
                    className={`h-6 w-6 transition-colors ${
                      star <= (hovered || rating)
                        ? 'fill-warning text-warning'
                        : 'text-muted-foreground/40'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Optional comment */}
            {rating > 0 && (
              <textarea
                className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Optional: share more about your experience..."
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            )}

            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}

            {rating > 0 && (
              <Button
                size="sm"
                className="mt-3"
                onClick={handleSubmit}
                disabled={isPending}
              >
                {isPending ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            )}
          </div>

          <button
            onClick={dismiss}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss feedback prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
