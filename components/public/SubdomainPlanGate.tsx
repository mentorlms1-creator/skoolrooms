/**
 * components/public/SubdomainPlanGate.tsx — Public-subdomain plan gating
 *
 * Decides what students/visitors see on a teacher's subdomain based on the
 * teacher's plan state.
 *   - hard_locked → render the "Service unavailable" full-page card.
 *   - soft_downgraded → render the children with a sticky paused banner.
 *   - everyone else → render children unmodified.
 *
 * Server Component. Used from `[subdomain]/page.tsx`, `/join/[token]/page.tsx`,
 * and `/join/[token]/pay/[enrollmentId]/page.tsx`.
 */

import { getPlanState } from '@/lib/auth/plan-state'

type TeacherForGate = {
  plan: string
  plan_expires_at: string | null
  grace_until: string | null
  downgraded_at: string | null
  trial_ends_at: string | null
  name: string
}

/**
 * Returns 'block' when this surface should refuse to render (hard cancel),
 * 'banner' when it should render with a paused notice (soft downgrade), or
 * 'pass' when the teacher is in good standing.
 */
export function resolveSubdomainGate(
  teacher: TeacherForGate,
): 'block' | 'banner' | 'pass' {
  const state = getPlanState(teacher)
  if (state.kind === 'hard_locked') return 'block'
  if (state.kind === 'soft_downgraded') return 'banner'
  return 'pass'
}

export function SubdomainPausedBanner() {
  return (
    <div
      role="alert"
      className="border-b border-warning/40 bg-warning/10 px-4 py-3 text-center text-sm text-warning-foreground"
    >
      <strong>Service paused.</strong> The teacher needs to renew their
      subscription before new sign-ups can resume. Existing students still have
      access to their classes.
    </div>
  )
}

export function SubdomainUnavailable({ teacherName }: { teacherName: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-foreground">Service unavailable</h1>
      <p className="mt-3 text-muted-foreground">
        {teacherName}’s account is no longer active. If you’re a current
        student, please contact your teacher directly for the latest updates.
      </p>
    </div>
  )
}
