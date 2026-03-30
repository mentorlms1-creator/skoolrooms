import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Student Sign in — Lumscribe',
  description: 'Sign in to the Lumscribe student portal.',
}

export default function StudentLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-surface p-8 shadow-card">
          {/* Brand */}
          <div className="mb-8 text-center">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-brand-600">
              Student Portal
            </div>
            <h1 className="text-2xl font-bold text-ink">Lumscribe</h1>
            <p className="mt-1 text-sm text-muted">
              Sign in to access your courses
            </p>
          </div>

          <LoginForm action="student" redirectTo="/student" />

          {/* Footer links */}
          <div className="mt-6 flex flex-col items-center gap-3 text-sm">
            <Link
              href={ROUTES.PLATFORM.forgotPassword}
              className="text-muted hover:text-ink"
            >
              Forgot your password?
            </Link>
            <Link
              href={ROUTES.PLATFORM.login}
              className="text-muted hover:text-ink"
            >
              Sign in as a teacher instead
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
