// =============================================================================
// lib/admin/view-as-session.ts — View-as cookie helpers (server-side only)
// Cookie: admin_view_as — HttpOnly, Secure, SameSite=lax, 30-min TTL
// Signed with CRON_SECRET (HMAC-SHA256) to prevent forgery.
// =============================================================================

import { cookies } from 'next/headers'
import { createHmac } from 'crypto'

export const VIEW_AS_COOKIE = 'admin_view_as'
const TTL_MS = 30 * 60 * 1000 // 30 minutes

export type ViewAsSession = {
  teacherId: string
  teacherEmail: string
  startedAt: string // ISO UTC
  expiresAt: string // ISO UTC
}

function sign(payload: string): string {
  const secret = process.env.CRON_SECRET ?? ''
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function buildViewAsCookieValue(session: ViewAsSession): string {
  const payload = JSON.stringify(session)
  const sig = sign(payload)
  return Buffer.from(JSON.stringify({ payload, sig })).toString('base64')
}

export async function getViewAsSession(): Promise<ViewAsSession | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(VIEW_AS_COOKIE)?.value
  if (!raw) return null

  try {
    const { payload, sig } = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as {
      payload: string
      sig: string
    }
    if (sign(payload) !== sig) return null

    const session = JSON.parse(payload) as ViewAsSession
    if (new Date(session.expiresAt) < new Date()) return null

    return session
  } catch {
    return null
  }
}

export function makeViewAsSession(teacherId: string, teacherEmail: string): ViewAsSession {
  const now = new Date()
  return {
    teacherId,
    teacherEmail,
    startedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TTL_MS).toISOString(),
  }
}

/** Returns true if a valid view-as session is active (for write-block checks). */
export async function getIsViewAsActive(): Promise<boolean> {
  const session = await getViewAsSession()
  return session !== null
}
