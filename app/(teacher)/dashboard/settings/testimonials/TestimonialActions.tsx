'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  deleteTestimonialAction,
  updateTestimonialAction,
  reorderTestimonialsAction,
} from '@/lib/actions/testimonials'

type Props = {
  testimonialId: string
  isPublished: boolean
  canMoveUp: boolean
  canMoveDown: boolean
}

export function TestimonialActions({ testimonialId, isPublished, canMoveUp, canMoveDown }: Props) {
  const [isPending, startTransition] = useTransition()

  function togglePublish() {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('is_published', String(!isPublished))
      await updateTestimonialAction(testimonialId, fd)
    })
  }

  function moveUp() {
    startTransition(async () => {
      await reorderTestimonialsAction(testimonialId, 'up')
    })
  }

  function moveDown() {
    startTransition(async () => {
      await reorderTestimonialsAction(testimonialId, 'down')
    })
  }

  function handleDelete() {
    if (!confirm('Delete this testimonial?')) return
    startTransition(async () => {
      await deleteTestimonialAction(testimonialId)
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={togglePublish}
        disabled={isPending}
      >
        {isPublished ? 'Unpublish' : 'Publish'}
      </Button>

      {canMoveUp && (
        <Button variant="outline" size="sm" onClick={moveUp} disabled={isPending}>
          Move Up
        </Button>
      )}

      {canMoveDown && (
        <Button variant="outline" size="sm" onClick={moveDown} disabled={isPending}>
          Move Down
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={isPending}
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        Delete
      </Button>
    </div>
  )
}
