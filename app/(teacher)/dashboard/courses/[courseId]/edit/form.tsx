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
import { toast } from 'sonner'
import { useUIContext } from '@/providers/UIProvider'
import { updateCourseAction, deleteCourseAction } from '@/lib/actions/courses'
import { ROUTES } from '@/constants/routes'

type EditCourseFormProps = {
  courseId: string
  teacherId: string
  defaultTitle: string
  defaultDescription: string
  defaultThumbnailUrl?: string
  defaultStatus: string
}

export function EditCourseForm({
  courseId,
  teacherId,
  defaultTitle,
  defaultDescription,
  defaultThumbnailUrl,
  defaultStatus,
}: EditCourseFormProps) {
  const router = useRouter()
  const { confirm } = useUIContext()
  const [isPending, startTransition] = useTransition()

  const [title, setTitle] = useState(defaultTitle)
  const [description, setDescription] = useState(defaultDescription)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>(
    defaultThumbnailUrl,
  )
  const [error, setError] = useState<string | null>(null)

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
