'use client'

/**
 * components/teacher/ProfileSettingsForm.tsx — Teacher profile edit form
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card } from '@/components/ui/Card'
import { updateProfileAction } from '@/lib/actions/teacher-settings'

type ProfileSettingsFormProps = {
  initialData: {
    name: string
    bio: string
    city: string
    profilePhotoUrl: string
    isPubliclyListed: boolean
    subjectTags: string
    teachingLevels: string
  }
}

export function ProfileSettingsForm({ initialData }: ProfileSettingsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const formData = new FormData(e.currentTarget)
    const result = await updateProfileAction(formData)

    if (result.success) {
      setMessage({ type: 'success', text: 'Profile updated.' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error })
    }

    setLoading(false)
  }

  return (
    <Card className="p-6">
      {message && (
        <div
          className={`mb-4 rounded-md px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-danger/10 text-danger'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          name="name"
          defaultValue={initialData.name}
          required
          minLength={2}
        />

        <Textarea
          label="Bio"
          name="bio"
          defaultValue={initialData.bio}
          placeholder="Tell students about yourself..."
          rows={3}
        />

        <Input
          label="City"
          name="city"
          defaultValue={initialData.city}
          placeholder="e.g., Lahore"
        />

        <Input
          label="Subject Tags (comma-separated)"
          name="subject_tags"
          defaultValue={initialData.subjectTags}
          placeholder="e.g., Math, Physics, Chemistry"
        />

        <Input
          label="Teaching Levels (comma-separated)"
          name="teaching_levels"
          defaultValue={initialData.teachingLevels}
          placeholder="e.g., O-Level, A-Level, Matric"
        />

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            name="is_publicly_listed"
            id="is_publicly_listed"
            defaultChecked={initialData.isPubliclyListed}
            className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
          />
          <label htmlFor="is_publicly_listed" className="text-sm text-ink">
            Show my profile on the public explore page
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" loading={loading}>
            Save Profile
          </Button>
        </div>
      </form>
    </Card>
  )
}
