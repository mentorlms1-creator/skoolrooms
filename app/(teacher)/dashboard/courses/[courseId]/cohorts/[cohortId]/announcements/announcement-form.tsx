'use client'

/**
 * Announcement creation form — Client Component
 * Uses RichTextEditor for body + FileUpload for optional attachment.
 * Calls createAnnouncementAction server action.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { FileUpload } from '@/components/ui/FileUpload'
import { Button } from '@/components/ui/Button'
import { useUIContext } from '@/providers/UIProvider'
import { createAnnouncementAction } from '@/lib/actions/announcements'

type AnnouncementCreateFormProps = {
  cohortId: string
}

export function AnnouncementCreateForm({ cohortId }: AnnouncementCreateFormProps) {
  const router = useRouter()
  const { addToast } = useUIContext()
  const [isPending, startTransition] = useTransition()

  const [body, setBody] = useState('')
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    setError(null)

    // Strip HTML tags to check if body has content
    const textContent = body.replace(/<[^>]*>/g, '').trim()
    if (!textContent) {
      setError('Announcement body is required.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('cohort_id', cohortId)
      formData.set('body', body)
      if (fileUrl) {
        formData.set('file_url', fileUrl)
      }

      const result = await createAnnouncementAction(formData)

      if (!result.success) {
        setError(result.error)
        return
      }

      addToast({ type: 'success', message: 'Announcement posted successfully!' })

      // Reset form
      setBody('')
      setFileUrl(null)

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
      <RichTextEditor
        content={body}
        onChange={setBody}
        placeholder="Write your announcement here..."
        label="Announcement"
      />

      <div>
        <p className="mb-2 text-sm font-medium text-ink">Attachment (optional)</p>
        <FileUpload
          fileType="announcement"
          entityId={cohortId}
          onUploadComplete={(url) => setFileUrl(url)}
          currentUrl={fileUrl ?? undefined}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" loading={isPending}>
          Post Announcement
        </Button>
      </div>
    </form>
  )
}
