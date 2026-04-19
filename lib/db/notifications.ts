// =============================================================================
// lib/db/notifications.ts — All queries for notifications table
// All writes use createAdminClient() (service role).
// =============================================================================

import { createAdminClient } from '@/supabase/server'
import {
  buildPage,
  decodeCursor,
  type CursorPage,
} from '@/lib/pagination/cursor'
import { NOTIFICATIONS_PAGE_SIZE, clampLimit } from '@/lib/pagination/limits'

// -----------------------------------------------------------------------------
// Row types
// -----------------------------------------------------------------------------

export type NotificationRow = {
  id: string
  user_type: 'teacher' | 'student'
  user_id: string
  kind: string
  title: string
  body: string
  link_url: string | null
  read_at: string | null
  created_at: string
}

export type CreateNotificationInput = {
  userType: 'teacher' | 'student'
  userId: string
  kind: string
  title: string
  body: string
  linkUrl?: string
}

// -----------------------------------------------------------------------------
// createNotification
// -----------------------------------------------------------------------------

export async function createNotification(
  input: CreateNotificationInput,
): Promise<NotificationRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_type: input.userType,
      user_id: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      link_url: input.linkUrl ?? null,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[createNotification]', error.message)
    return null
  }

  return data as NotificationRow
}

// -----------------------------------------------------------------------------
// getNotificationsForUser — latest 20 notifications for a user
// -----------------------------------------------------------------------------

export async function getNotificationsForUser(
  userId: string,
  userType: 'teacher' | 'student',
  limit = 20,
): Promise<NotificationRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('user_type', userType)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[getNotificationsForUser]', error.message)
    return []
  }

  return (data ?? []) as NotificationRow[]
}

// -----------------------------------------------------------------------------
// getNotificationsForUserPage — Cursor-paginated history view.
// The bell-icon dropdown still uses getNotificationsForUser (limit 20); this
// helper backs a future "show all" notifications screen.
// -----------------------------------------------------------------------------
export async function getNotificationsForUserPage(input: {
  userId: string
  userType: 'teacher' | 'student'
  cursor?: string | null
  limit?: number
}): Promise<CursorPage<NotificationRow>> {
  const supabase = createAdminClient()
  const limit = clampLimit(input.limit, NOTIFICATIONS_PAGE_SIZE)

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', input.userId)
    .eq('user_type', input.userType)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  const decoded = decodeCursor(input.cursor ?? null)
  if (decoded) query = query.lt('created_at', decoded.t)

  const { data, error } = await query.limit(limit + 1)
  if (error || !data) return { rows: [], nextCursor: null }

  return buildPage(data as NotificationRow[], limit)
}

// -----------------------------------------------------------------------------
// markNotificationRead
// -----------------------------------------------------------------------------

export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null)

  if (error) {
    console.error('[markNotificationRead]', error.message)
  }
}

// -----------------------------------------------------------------------------
// markAllNotificationsRead
// -----------------------------------------------------------------------------

export async function markAllNotificationsRead(
  userId: string,
  userType: 'teacher' | 'student',
): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('user_type', userType)
    .is('read_at', null)

  if (error) {
    console.error('[markAllNotificationsRead]', error.message)
  }
}

// -----------------------------------------------------------------------------
// getUnreadCountForUser
// -----------------------------------------------------------------------------

export async function getUnreadCountForUser(
  userId: string,
  userType: 'teacher' | 'student',
): Promise<number> {
  const supabase = createAdminClient()

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('user_type', userType)
    .is('read_at', null)

  if (error) {
    console.error('[getUnreadCountForUser]', error.message)
    return 0
  }

  return count ?? 0
}
