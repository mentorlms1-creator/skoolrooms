'use client'

/**
 * app/(teacher)/dashboard/courses/new/form.tsx — Create course form
 *
 * Client Component. Title input + RichTextEditor for description.
 * Calls createCourseAction and navigates to course detail on success.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { useUIContext } from '@/providers/UIProvider'
import { createCourseAction } from '@/lib/actions/courses'
import { ROUTES } from '@/constants/routes'

export function CreateCourseForm() {
  const router = useRouter()
  const { addToast } = useUIContext()
  const [isPending, startTransition] = useTransition()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    setError(null)

    if (title.trim().length < 3) {
      setError('Course title must be at least 3 characters.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('title', title.trim())
      formData.set('description', description)

      const result = await createCourseAction(formData)

      if (!result.success) {
        setError(result.error)
        return
      }

      addToast({ type: 'success', message: 'Course created successfully!' })
      router.push(ROUTES.TEACHER.courseDetail(result.data.courseId))
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
      className="flex flex-col gap-6"
    >
      <div className="space-y-2">
        <Label htmlFor="course-title">Course Title</Label>
        <Input
          id="course-title"
          placeholder="e.g. O-Level Mathematics"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        {error && error.includes('title') && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <RichTextEditor
        label="Description"
        content={description}
        onChange={setDescription}
        placeholder="Describe what students will learn in this course..."
      />

      {error && !error.includes('title') && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          Create Course
        </Button>
      </div>
    </form>
  )
}
