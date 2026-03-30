'use client'

/**
 * hooks/useRealtime.ts — Supabase realtime subscription wrapper
 *
 * Creates a subscription on mount, cleans up on unmount.
 * Uses the browser Supabase client from @/supabase/client.
 *
 * Usage:
 *   const { status } = useRealtime({
 *     table: 'announcements',
 *     filter: 'cohort_id=eq.abc123',
 *     event: 'INSERT',
 *     onData: (payload) => setAnnouncements(prev => [...prev, payload.new]),
 *   })
 */

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/supabase/client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

type RealtimeStatus = 'connecting' | 'connected' | 'disconnected'

type UseRealtimeOptions<T extends Record<string, unknown>> = {
  table: string
  filter?: string
  event?: RealtimeEvent
  onData: (payload: RealtimePostgresChangesPayload<T>) => void
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useRealtime<T extends Record<string, unknown>>({
  table,
  filter,
  event = '*',
  onData,
}: UseRealtimeOptions<T>): { status: RealtimeStatus } {
  const [status, setStatus] = useState<RealtimeStatus>('connecting')

  // Use refs so the subscription callback always sees the latest onData
  // without needing to re-subscribe on every render.
  const onDataRef = useRef(onData)
  onDataRef.current = onData

  useEffect(() => {
    const supabase = createClient()
    const channelName = `realtime-${table}-${filter ?? 'all'}-${event}`

    const channelConfig: {
      event: RealtimeEvent
      schema: string
      table: string
      filter?: string
    } = {
      event,
      schema: 'public',
      table,
    }

    if (filter) {
      channelConfig.filter = filter
    }

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as const,
        channelConfig,
        (payload: RealtimePostgresChangesPayload<T>) => {
          onDataRef.current(payload)
        },
      )
      .subscribe((channelStatus: string) => {
        if (channelStatus === 'SUBSCRIBED') {
          setStatus('connected')
        } else if (channelStatus === 'CLOSED' || channelStatus === 'CHANNEL_ERROR') {
          setStatus('disconnected')
        } else {
          setStatus('connecting')
        }
      })

    return () => {
      setStatus('disconnected')
      supabase.removeChannel(channel)
    }
  }, [table, filter, event])

  return { status }
}
