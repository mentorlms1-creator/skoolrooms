'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createTestimonialAction } from '@/lib/actions/testimonials'

export function TestimonialForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (success) {
    return (
      <div className="rounded-md bg-success/10 p-4 text-sm text-success">
        Testimonial added.{' '}
        <button className="underline" onClick={() => setSuccess(false)}>
          Add another
        </button>
      </div>
    )
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createTestimonialAction(formData)
      if (result.success) {
        setSuccess(true)
      } else {
        setError(result.error ?? 'Failed to create testimonial.')
      }
    })
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="author_name">Student name *</Label>
        <Input
          id="author_name"
          name="author_name"
          placeholder="Ahmed Khan"
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="author_role">Role / description (optional)</Label>
        <Input
          id="author_role"
          name="author_role"
          placeholder="Matric student"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="quote">Testimonial *</Label>
        <Textarea
          id="quote"
          name="quote"
          placeholder="The classes were excellent..."
          rows={4}
          required
          minLength={10}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="is_published"
          name="is_published"
          type="checkbox"
          value="true"
          className="h-4 w-4 rounded border-border"
        />
        <Label htmlFor="is_published">Publish immediately (show on your public page)</Label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Saving...' : 'Add Testimonial'}
      </Button>
    </form>
  )
}
