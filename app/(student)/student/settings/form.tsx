'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateStudentProfileAction } from '@/lib/actions/student-settings'
import { updateOwnGuardianContact } from '@/lib/actions/students'

type Props = {
  defaultName: string
  defaultPhone: string
  email: string
  memberSince: string
  guardianDefaults: {
    parent_name: string | null
    parent_phone: string | null
    parent_email: string | null
  }
}

export function StudentSettingsForm({ defaultName, defaultPhone, email, memberSince, guardianDefaults }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [parentName, setParentName] = useState(guardianDefaults.parent_name ?? '')
  const [parentPhone, setParentPhone] = useState(guardianDefaults.parent_phone ?? '')
  const [parentEmail, setParentEmail] = useState(guardianDefaults.parent_email ?? '')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const profileResult = await updateStudentProfileAction(formData)

    if (!profileResult.success) {
      setError(profileResult.error)
      setLoading(false)
      return
    }

    const guardianResult = await updateOwnGuardianContact({
      parent_name: parentName,
      parent_phone: parentPhone,
      parent_email: parentEmail,
    })

    if (!guardianResult.success) {
      setError(guardianResult.error)
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

      <div className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-4 space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
            Emergency / Guardian Contact
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Optional. Shared only with your teachers.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="parent_name" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
            Guardian name
          </Label>
          <Input
            id="parent_name"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            maxLength={120}
            placeholder="e.g. Mother, Father, Sibling"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="parent_phone" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
            Guardian phone
          </Label>
          <Input
            id="parent_phone"
            type="tel"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
            maxLength={32}
            placeholder="+92 300 1234567"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="parent_email" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
            Guardian email
          </Label>
          <Input
            id="parent_email"
            type="email"
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
            maxLength={254}
            placeholder="guardian@example.com"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={loading} className="w-full rounded-xl sm:w-auto">Save Changes</Button>
      </div>
    </form>
  )
}
