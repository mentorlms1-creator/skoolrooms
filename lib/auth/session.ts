// =============================================================================
// lib/auth/session.ts — Lightweight session probe for marketing-site nav
//
// Cheap auth lookup that returns the user's "primary" dashboard if signed in,
// or null otherwise. Used by PublicNavbar to swap "Log In / Start Free" for a
// "Go to Dashboard" link when the visitor already has a session.
// =============================================================================

import { cache } from 'react'
import { createClient } from '@/supabase/server'

export type SessionDestination = {
  href: string
  label: string
}

/**
 * Resolve the logged-in user's primary destination. Admins → /admin, teachers →
 * /dashboard, students → /student. Returns null if no session.
 *
 * Wrapped in React cache() so repeated calls within the same request reuse a
 * single Supabase lookup. Never throws — auth probes on the marketing site
 * should fail open.
 */
export const getSessionDestination = cache(
  async (): Promise<SessionDestination | null> => {
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return null

      if (user.user_metadata?.role === 'admin') {
        return { href: '/admin', label: 'Admin Dashboard' }
      }

      // A user could have both a teachers row and a students row (rare). Prefer
      // teacher when both exist, since paid users are more likely to bounce
      // off the marketing site.
      const [{ data: teacher }, { data: student }] = await Promise.all([
        supabase
          .from('teachers')
          .select('id')
          .eq('supabase_auth_id', user.id)
          .maybeSingle(),
        supabase
          .from('students')
          .select('id')
          .eq('supabase_auth_id', user.id)
          .maybeSingle(),
      ])

      if (teacher) return { href: '/dashboard', label: 'Go to Dashboard' }
      if (student) return { href: '/student', label: 'My Courses' }
      return null
    } catch {
      return null
    }
  },
)
