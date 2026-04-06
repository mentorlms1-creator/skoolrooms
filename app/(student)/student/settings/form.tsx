'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
        <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}
      {success && (
        <div className="rounded-2xl bg-success/10 px-4 py-3 text-sm text-success">Profile updated.</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
          Full Name
        </Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultName}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
          Phone
        </Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={defaultPhone}
          placeholder="+923001234567"
          required
        />
      </div>

      <div className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-4">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="h-3.5 w-3.5 text-muted-foreground/50" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Email</p>
        </div>
        <p className="text-foreground font-medium">{email}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Email cannot be changed here.</p>
      </div>

      <div className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-4">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/50" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Member Since</p>
        </div>
        <p className="text-foreground font-medium">{memberSince}</p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={loading} className="w-full rounded-xl sm:w-auto">Save Changes</Button>
      </div>
    </form>
  )
}
