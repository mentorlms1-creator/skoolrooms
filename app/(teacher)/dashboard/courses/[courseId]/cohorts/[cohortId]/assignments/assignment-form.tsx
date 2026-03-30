'use client'

/**
 * Assignment creation form — Client Component
 * Uses RichTextEditor for description + FileUpload for optional attachment.
 * Calls createAssignmentAction server action.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { FileUpload } from '@/components/ui/FileUpload'
import { Button } from '@/components/ui/Button'
import { useUIContext } from '@/providers/UIProvider'
import { createAssignmentAction } from '@/lib/actions/assignments'

type AssignmentCreateFormProps = {
  cohortId: string
}

export function AssignmentCreateForm({ cohortId }: AssignmentCreateFormProps) {
  const router = useRouter()
  const { addToast } = useUIContext()
  const [isPending, startTransition] = useTransition()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    setError(null)

    if (title.trim().length < 3) {
      setError('Title must be at least 3 characters.')
      return
    }

    const textContent = description.replace(/<[^>]*>/g, '').trim()
    if (!textContent) {
      setError('Description is required.')
      return
    }

    if (!dueDate) {
      setError('Due date is required.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('cohort_id', cohortId)
      formData.set('title', title)
      formData.set('description', description)
      formData.set('due_date', dueDate)
      if (fileUrl) {
        formData.set('file_url', fileUrl)
      }

      const result = await createAssignmentAction(formData)

      if (!result.success) {
        setError(result.error)
        return
      }

      addToast({ type: 'success', message: 'Assignment created successfully!' })

      // Reset form
      setTitle('')
      setDescription('')
      setFileUrl(null)
      setDueDate('')

      router.refresh()
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Chapter 3 Exercises"
        required
      />

      <RichTextEditor
        content={description}
        onChange={setDescription}
        placeholder="Describe the assignment, instructions, and requirements..."
        label="Description"
      />

      <Input
        label="Due Date"
        type="datetime-local"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        required
      />

      <div>
        <p className="mb-2 text-sm font-medium text-ink">Attachment (optional)</p>
        <FileUpload
          fileType="assignment"
          entityId={cohortId}
          onUploadComplete={(url) => setFileUrl(url)}
          currentUrl={fileUrl ?? undefined}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" loading={isPending}>
          Create Assignment
        </Button>
      </div>
    </form>
  )
}
