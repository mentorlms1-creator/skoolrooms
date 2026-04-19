'use client'

/**
 * app/(teacher)/dashboard/courses/[courseId]/edit/form.tsx — Edit course form
 *
 * Client Component. Title, RichTextEditor, FileUpload for thumbnail.
 * Save Draft, Publish, and Delete actions.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { FileUpload } from '@/components/ui/FileUpload'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { useUIContext } from '@/providers/UIProvider'
import { updateCourseAction, deleteCourseAction } from '@/lib/actions/courses'
import { ROUTES } from '@/constants/routes'
import { COURSE_CATEGORIES, normalizeTags, TAG_LIMITS } from '@/constants/course-categories'

const NO_CATEGORY = '__none__'

type EditCourseFormProps = {
  courseId: string
  teacherId: string
  defaultTitle: string
  defaultDescription: string
  defaultThumbnailUrl?: string
  defaultStatus: string
  defaultCategory: string | null
  defaultTags: string[]
}

export function EditCourseForm({
  courseId,
  teacherId,
  defaultTitle,
  defaultDescription,
  defaultThumbnailUrl,
  defaultStatus,
  defaultCategory,
  defaultTags,
}: EditCourseFormProps) {
  const router = useRouter()
  const { confirm } = useUIContext()
  const [isPending, startTransition] = useTransition()

  const [title, setTitle] = useState(defaultTitle)
  const [description, setDescription] = useState(defaultDescription)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>(
    defaultThumbnailUrl,
  )
  const [category, setCategory] = useState<string>(defaultCategory ?? NO_CATEGORY)
  const [tagsInput, setTagsInput] = useState(defaultTags.join(', '))
  const [error, setError] = useState<string | null>(null)

  const previewTags = normalizeTags(tagsInput.split(','))

  function handleSave(publishStatus?: 'published') {
    setError(null)

    if (title.trim().length < 3) {
      setError('Course title must be at least 3 characters.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('title', title.trim())
      formData.set('description', description)
      if (thumbnailUrl) {
        formData.set('thumbnail_url', thumbnailUrl)
      }
      if (publishStatus) {
        formData.set('status', publishStatus)
      }
      formData.set('category', category === NO_CATEGORY ? '' : category)
      // Always send at least one (possibly empty) tags entry so server picks it up
      if (previewTags.length === 0) {
        formData.append('tags', '')
      } else {
        for (const t of previewTags) formData.append('tags', t)
      }

      const result = await updateCourseAction(courseId, formData)

      if (!result.success) {
        setError(result.error)
        return
      }

      toast.success(publishStatus
          ? 'Course published successfully!'
          : 'Course saved successfully!')
      router.push(ROUTES.TEACHER.courseDetail(courseId))
    })
  }

  function handleDelete() {
    confirm({
      title: 'Delete Course',
      message:
        'Are you sure you want to delete this course? This action cannot be undone.',
      confirmText: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        const result = await deleteCourseAction(courseId)

        if (!result.success) {
          toast.error(result.error)
          return
        }

        toast.success('Course deleted.')
        router.push(ROUTES.TEACHER.courses)
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
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

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Thumbnail Image
        </label>
        <FileUpload
          fileType="thumbnail"
          entityId={`${teacherId}/${courseId}`}
          onUploadComplete={(url) => setThumbnailUrl(url)}
          currentUrl={thumbnailUrl}
        />
      </div>

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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Button
          type="button"
          variant="danger"
          onClick={handleDelete}
          disabled={isPending}
        >
          Delete Course
        </Button>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleSave()}
            loading={isPending}
          >
            Save Draft
          </Button>
          {defaultStatus === 'draft' && (
            <Button
              type="button"
              onClick={() => handleSave('published')}
              loading={isPending}
            >
              Publish
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
