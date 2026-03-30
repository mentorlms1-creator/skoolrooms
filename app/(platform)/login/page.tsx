import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Sign in — Lumscribe',
  description: 'Sign in to your Lumscribe teacher dashboard.',
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-surface p-8 shadow-card">
          {/* Brand */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-ink">Lumscribe</h1>
            <p className="mt-1 text-sm text-muted">
              Sign in to your teacher dashboard
            </p>
          </div>

          <LoginForm action="teacher" redirectTo={ROUTES.TEACHER.dashboard} />

          {/* Footer links */}
          <div className="mt-6 flex flex-col items-center gap-3 text-sm">
            <p className="text-muted">
              Don&apos;t have an account?{' '}
              <Link
                href={ROUTES.PLATFORM.signup}
                className="font-medium text-brand-600 hover:text-brand-500"
              >
                Create account
              </Link>
            </p>
            <Link
              href={ROUTES.PLATFORM.studentLogin}
              className="text-muted hover:text-ink"
            >
              Sign in as a student instead
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
