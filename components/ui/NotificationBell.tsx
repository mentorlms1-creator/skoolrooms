'use client'

// =============================================================================
// components/ui/NotificationBell.tsx — Realtime notification bell with popover
// Shows last 20 notifications. Mark all read + per-item navigate + realtime.
// =============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { useRealtime } from '@/hooks/useRealtime'
import { markNotificationReadAction, markAllReadAction } from '@/lib/actions/notifications'
import { formatPKT } from '@/lib/time/pkt'
import { cn } from '@/lib/utils'
import type { NotificationRow } from '@/lib/db/notifications'

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

type NotificationBellProps = {
  initialCount: number
  initialNotifications: NotificationRow[]
  userId: string
  userType: 'teacher' | 'student'
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function NotificationBell({
  initialCount,
  initialNotifications,
  userId,
  userType,
}: NotificationBellProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [notifications, setNotifications] = useState<NotificationRow[]>(initialNotifications)
  const [unreadCount, setUnreadCount] = useState(initialCount)
  const [open, setOpen] = useState(false)

  // Subscribe to new notification inserts for this user
  useRealtime<Record<string, unknown>>({
    table: 'notifications',
    filter: `user_id=eq.${userId}`,
    event: 'INSERT',
    onData: (payload) => {
      const newRow = payload.new as NotificationRow
      if (!newRow?.id) return
      setNotifications((prev) => [newRow, ...prev].slice(0, 20))
      setUnreadCount((c) => c + 1)
    },
  })

  // Subscribe to updates (read_at changes from other sessions / server)
  useRealtime<Record<string, unknown>>({
    table: 'notifications',
    filter: `user_id=eq.${userId}`,
    event: 'UPDATE',
    onData: (payload) => {
      const updated = payload.new as NotificationRow
      if (!updated?.id) return
      setNotifications((prev) => {
        const next = prev.map((n) =>
          n.id === updated.id ? { ...n, read_at: updated.read_at } : n,
        )
        setUnreadCount(next.filter((n) => !n.read_at).length)
        return next
      })
    },
  })

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllReadAction()
      const now = new Date().toISOString()
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })))
      setUnreadCount(0)
    })
  }

  function handleClickNotification(notification: NotificationRow) {
    startTransition(async () => {
      if (!notification.read_at) {
        await markNotificationReadAction(notification.id)
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n,
          ),
        )
        setUnreadCount((c) => Math.max(0, c - 1))
      }
      setOpen(false)
      if (notification.link_url) {
        router.push(notification.link_url)
      }
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card shadow-sm ring-1 ring-foreground/5 text-muted-foreground hover:text-foreground transition-colors relative"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-5 w-5" strokeWidth={1.8} />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[360px] p-0 shadow-xl border-border/60"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllRead}
              disabled={isPending}
            >
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClickNotification(n)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors',
                      !n.read_at && 'bg-accent/5',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read_at && (
                        <span className="mt-1.5 flex-shrink-0 h-2 w-2 rounded-full bg-accent" />
                      )}
                      <div className={cn('flex-1 min-w-0', n.read_at && 'pl-4')}>
                        <p className="text-[13px] font-medium text-foreground leading-snug line-clamp-1">
                          {n.title}
                        </p>
                        <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                          {n.body}
                        </p>
                        <p className="text-[11px] text-muted-foreground/60 mt-1">
                          {formatPKT(n.created_at, 'relative')}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
