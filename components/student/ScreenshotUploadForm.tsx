'use client'

/**
 * components/student/ScreenshotUploadForm.tsx
 * Client component for uploading payment screenshot.
 * Used on the student payment page after enrollment.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileUpload } from '@/components/ui/FileUpload'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { submitScreenshotAction } from '@/lib/actions/student-payments'

type ScreenshotUploadFormProps = {
  enrollmentId: string
  referenceCode: string
  existingScreenshotUrl: string | null
  paymentId?: string
}

export function ScreenshotUploadForm({
  enrollmentId,
  referenceCode,
  existingScreenshotUrl,
  paymentId,
}: ScreenshotUploadFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(
    existingScreenshotUrl,
  )
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  function handleUploadComplete(url: string) {
    setScreenshotUrl(url)
    setError(null)
  }

  function handleSubmit() {
    if (!screenshotUrl) {
      setError('Please upload a screenshot of your payment first.')
      return
    }

    startTransition(async () => {
      const result = await submitScreenshotAction(enrollmentId, screenshotUrl, paymentId)

      if (!result.success) {
        setError(result.error)
        return
      }

      setSubmitted(true)
      setError(null)
      router.refresh()
    })
  }

  if (submitted) {
    return (
      <Card className="p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-6 w-6 text-primary"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground">Screenshot Submitted</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Your payment screenshot has been submitted. The teacher will review and
          verify your payment soon.
        </p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Reference code reminder */}
      <Card className="border-primary/20 bg-primary/10 p-4">
        <p className="text-sm font-medium text-primary">
          Include this reference in your bank transfer:
        </p>
        <p className="mt-1 text-2xl font-bold tracking-wider text-primary">
          REF-{referenceCode}
        </p>
      </Card>

      {/* Upload area */}
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">
          Upload payment screenshot
        </label>
        <FileUpload
          fileType="screenshot"
          entityId={`enrollment/${enrollmentId}`}
          onUploadComplete={handleUploadComplete}
          currentUrl={existingScreenshotUrl ?? undefined}
        />
      </div>

      {/* Error message */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Submit button */}
      <Button
        onClick={handleSubmit}
        loading={isPending}
        disabled={!screenshotUrl || isPending}
        size="lg"
        className="w-full"
      >
        Submit Screenshot
      </Button>
    </div>
  )
}
