'use client'

// =============================================================================
// app/(teacher)/onboarding/step-3/form.tsx — Profile photo + bio form
// =============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { FileUpload } from '@/components/ui/FileUpload'
import { saveOnboardingStep3 } from '@/lib/actions/onboarding'
import { ROUTES } from '@/constants/routes'

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

type Step3FormProps = {
  teacherId: string
  defaultBio: string
  defaultPhotoUrl: string
}

export function Step3Form({
  teacherId,
  defaultBio,
  defaultPhotoUrl,
}: Step3FormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [bio, setBio] = useState(defaultBio)
  const [photoUrl, setPhotoUrl] = useState(defaultPhotoUrl)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    setError(null)

    if (bio.trim().length < 10) {
      setError('Please write a bio of at least 10 characters.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('bio', bio.trim())
      if (photoUrl) {
        formData.set('profile_photo_url', photoUrl)
      }

      const result = await saveOnboardingStep3(formData)

      if (!result.success) {
        setError(result.error)
        return
      }

      router.push(ROUTES.TEACHER.dashboard)
    })
  }

  return (
    <div className="space-y-6">
      {/* Profile photo */}
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">
          Profile Photo
        </label>
        <FileUpload
          fileType="profile"
          entityId={teacherId}
          onUploadComplete={(url) => setPhotoUrl(url)}
          currentUrl={photoUrl || undefined}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Optional. JPEG, PNG, or WebP. Max 2MB.
        </p>
      </div>

      {/* Bio */}
      <div>
        <Textarea
          label="Bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell students about your teaching experience, qualifications, and what makes your classes special..."
          rows={5}
          error={error ?? undefined}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Minimum 10 characters. This appears on your public profile.
        </p>
      </div>

      {/* Complete */}
      <Button
        onClick={handleSubmit}
        loading={isPending}
        disabled={isPending}
        className="w-full"
        size="lg"
      >
        Complete Setup
      </Button>
    </div>
  )
}
