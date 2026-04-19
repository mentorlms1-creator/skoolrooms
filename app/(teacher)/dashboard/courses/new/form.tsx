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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { createCourseAction } from '@/lib/actions/courses'
import { ROUTES } from '@/constants/routes'
import { COURSE_CATEGORIES, normalizeTags, TAG_LIMITS } from '@/constants/course-categories'

const NO_CATEGORY = '__none__'

export function CreateCourseForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>(NO_CATEGORY)
  const [tagsInput, setTagsInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const previewTags = normalizeTags(tagsInput.split(','))

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
      if (category !== NO_CATEGORY) {
        formData.set('category', category)
      } else {
        formData.set('category', '')
      }
      for (const t of previewTags) formData.append('tags', t)

      const result = await createCourseAction(formData)

      if (!result.success) {
        setError(result.error)
        return
      }

      toast.success('Course created successfully!')
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

      <div className="space-y-2">
        <Label htmlFor="course-category">Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="course-category" className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CATEGORY}>Uncategorized</SelectItem>
            {COURSE_CATEGORIES.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="course-tags">Tags</Label>
        <Input
          id="course-tags"
          placeholder="e.g. fsc-1, federal-board, beginner"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated. Max {TAG_LIMITS.max} tags, {TAG_LIMITS.maxLength} chars each. Lowercased automatically.
        </p>
        {previewTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {previewTags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

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
