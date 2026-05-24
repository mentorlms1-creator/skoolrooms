'use client'

// =============================================================================
// components/messaging/MessagesRealtime.tsx
//
// Keeps the inbox sidebar in sync without manual refreshes. Subscribes to
// direct_messages INSERTs (and read-state UPDATEs) involving the current user
// and triggers router.refresh() so the server-rendered threads list re-fetches
// with the new last-message preview, ordering, and unread counts.
//
// router.refresh() in the App Router is a soft RSC re-fetch — it preserves
// client state (the open conversation, scroll position, composer draft).
// =============================================================================

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtime } from '@/hooks/useRealtime'

type Props = {
  currentUserId: string
}

export function MessagesRealtime({ currentUserId }: Props) {
  const router = useRouter()

  // Coalesce bursts of events into a single refresh per ~150ms tick. Rapid
  // back-and-forth (or replays after reconnect) shouldn't fan out into many
  // RSC fetches.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function scheduleRefresh() {
    if (timerRef.current) return
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      router.refresh()
    }, 150)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  // Incoming messages directed at me (other party sent).
  useRealtime<Record<string, unknown>>({
    table: 'direct_messages',
    filter: `recipient_id=eq.${currentUserId}`,
    event: 'INSERT',
    onData: scheduleRefresh,
  })

  // My own sent messages — needed so the sidebar reorders/updates the last
  // message preview the instant we send, without waiting for the next nav.
  useRealtime<Record<string, unknown>>({
    table: 'direct_messages',
    filter: `sender_id=eq.${currentUserId}`,
    event: 'INSERT',
    onData: scheduleRefresh,
  })

  // Read receipts coming in (other party opened the thread). Keeps the
  // "Read" indicator and any unread badges accurate.
  useRealtime<Record<string, unknown>>({
    table: 'direct_messages',
    filter: `sender_id=eq.${currentUserId}`,
    event: 'UPDATE',
    onData: scheduleRefresh,
  })

  return null
}
