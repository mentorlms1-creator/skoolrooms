/**
 * app/(platform)/subscribe/page.tsx — Subscription page
 *
 * Server Component wrapper + Client Component for interactive form.
 * Flow:
 * 1. Teacher selects plan (Solo or Academy)
 * 2. subscribeAction determines: trial start or screenshot upload
 * 3. If trial: shows success, redirects to dashboard
 * 4. If screenshot: shows upload form → submitSubscriptionScreenshotAction
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { ROUTES } from '@/constants/routes'
import { SubscribeForm } from './SubscribeForm'

export default async function SubscribePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect to login if not authenticated
  if (!user) {
    redirect(ROUTES.PLATFORM.teacherLogin)
  }

  // Only teachers can subscribe
  const teacher = await getTeacherByAuthId(user.id)
  if (!teacher) {
    redirect(ROUTES.PLATFORM.teacherLogin)
  }

  // A teacher is "reactivating" (not new-signing-up) if anything in their
  // history points to a prior paid plan. plan === 'free' alone isn't enough —
  // a soft-downgraded teacher's plan is also 'free' but they're a returning
  // paid customer, not a new one.
  const isCurrentlyPaid = teacher.plan !== 'free'
  const isReactivation =
    teacher.downgraded_at != null || teacher.trial_started_at != null
  const isNewUpgrade = !isCurrentlyPaid && !isReactivation

  let headline: string
  let subhead: string
  if (isCurrentlyPaid) {
    headline = 'Renew Your Subscription'
    subhead = 'Renew your subscription to continue using premium features.'
  } else if (isReactivation) {
    headline = 'Reactivate Your Plan'
    subhead = 'Welcome back. Choose a plan to restore full access.'
  } else {
    headline = 'Upgrade Your Plan'
    subhead = 'Choose a plan to unlock more features and grow your teaching business.'
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <a href={ROUTES.TEACHER.dashboard} className="text-xl font-bold text-primary">
            Skool Rooms
          </a>
          <a
            href={ROUTES.TEACHER.settings.plan}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Back to Settings
          </a>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{headline}</h1>
          <p className="mt-2 text-muted-foreground">{subhead}</p>
        </div>

        <div className="mt-8">
          <SubscribeForm
            teacherId={teacher.id as string}
            currentPlan={teacher.plan as string}
            teacherName={teacher.name as string}
            isNewUpgrade={isNewUpgrade}
          />
        </div>
      </div>
    </div>
  )
}
