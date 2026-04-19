'use client'

// =============================================================================
// components/admin/ViewAsBar.tsx — Read-only impersonation banner
// Shown inside teacher dashboard when admin is in view-as mode.
// Props come from server component that reads getViewAsSession().
// Exit button calls DELETE /api/admin/view-as, then redirects to admin panel.
// =============================================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPKT } from '@/lib/time/pkt'

type ViewAsBarProps = {
  teacherEmail: string
  expiresAt: string
}

export function ViewAsBar({ teacherEmail, expiresAt }: ViewAsBarProps) {
  const router = useRouter()
  const [exiting, setExiting] = useState(false)

  async function handleExit() {
    setExiting(true)
    await fetch('/api/admin/view-as', { method: 'DELETE' })
    router.push('/admin/teachers')
  }

  return (
    <div className="sticky top-0 z-50 flex items-center gap-3 bg-destructive px-4 py-2.5 text-destructive-foreground shadow-sm">
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-sm font-medium">
        ADMIN VIEW — Read-only impersonation of{' '}
        <span className="font-bold">{teacherEmail}</span>
        {'. '}
        Expires {formatPKT(expiresAt, 'relative')}. Writes are disabled.
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 rounded-lg px-2 text-xs text-destructive-foreground hover:bg-destructive-foreground/20"
        onClick={handleExit}
        disabled={exiting}
      >
        <X className="h-3.5 w-3.5" />
        {exiting ? 'Exiting…' : 'Exit view'}
      </Button>
    </div>
  )
}
