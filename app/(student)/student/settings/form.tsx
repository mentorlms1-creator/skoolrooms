'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { updateStudentProfileAction } from '@/lib/actions/student-settings'

type Props = {
  defaultName: string
  defaultPhone: string
  email: string
  memberSince: string
}

export function StudentSettingsForm({ defaultName, defaultPhone, email, memberSince }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await updateStudentProfileAction(formData)

    if (!result.success) {
      setError(result.error)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}
      {success && (
        <div className="rounded-md bg-success/10 px-4 py-3 text-sm text-success">Profile updated.</div>
      )}

      <Input
        label="Full Name"
        name="name"
        defaultValue={defaultName}
        required
      />

      <Input
        label="Phone"
        name="phone"
        type="tel"
        defaultValue={defaultPhone}
        placeholder="+923001234567"
        required
      />

      <div>
        <p className="text-sm font-medium text-muted-foreground">Email</p>
        <p className="mt-1 text-foreground">{email}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Email cannot be changed here.</p>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground">Member Since</p>
        <p className="mt-1 text-foreground">{memberSince}</p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={loading} className="w-full sm:w-auto">Save Changes</Button>
      </div>
    </form>
  )
}
