'use client'

// =============================================================================
// app/(teacher)/onboarding/step-3/form.tsx — Profile photo + bio form
// =============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
      <div className="rounded-2xl bg-container p-5">
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
          Profile Photo
        </label>
        <div className="rounded-2xl overflow-hidden">
          <FileUpload
            fileType="profile"
            entityId={teacherId}
            onUploadComplete={(url) => setPhotoUrl(url)}
            currentUrl={photoUrl || undefined}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Optional. JPEG, PNG, or WebP. Max 2MB.
        </p>
      </div>

      {/* Bio */}
      <div className="rounded-2xl bg-container p-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bio" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell students about your teaching experience, qualifications, and what makes your classes special..."
            rows={5}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Minimum 10 characters. This appears on your public profile.
        </p>
      </div>

      {/* Complete */}
      <Button
        onClick={handleSubmit}
        loading={isPending}
        disabled={isPending}
        className="w-full rounded-xl"
        size="lg"
      >
        Complete Setup
      </Button>
    </div>
  )
}
