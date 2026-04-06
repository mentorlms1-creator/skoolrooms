'use client'

/**
 * components/teacher/ProfileSettingsForm.tsx — Teacher profile edit form
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
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
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            defaultValue={initialData.name}
            required
            minLength={2}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            name="bio"
            defaultValue={initialData.bio}
            placeholder="Tell students about yourself..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            name="city"
            defaultValue={initialData.city}
            placeholder="e.g., Lahore"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject_tags">Subject Tags (comma-separated)</Label>
          <Input
            id="subject_tags"
            name="subject_tags"
            defaultValue={initialData.subjectTags}
            placeholder="e.g., Math, Physics, Chemistry"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="teaching_levels">Teaching Levels (comma-separated)</Label>
          <Input
            id="teaching_levels"
            name="teaching_levels"
            defaultValue={initialData.teachingLevels}
            placeholder="e.g., O-Level, A-Level, Matric"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            name="is_publicly_listed"
            id="is_publicly_listed"
            defaultChecked={initialData.isPubliclyListed}
            className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
          />
          <label htmlFor="is_publicly_listed" className="text-sm text-foreground">
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
