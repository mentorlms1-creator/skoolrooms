import type { Metadata } from 'next'
import Link from 'next/link'
import { SignupForm } from '@/components/auth/SignupForm'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Create account — Lumscribe',
  description: 'Create your Lumscribe teacher account and start managing your courses.',
}

export default function SignupPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-surface p-8 shadow-card">
          {/* Brand */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-ink">Lumscribe</h1>
            <p className="mt-1 text-sm text-muted">
              Create your teacher account
            </p>
          </div>

          <SignupForm />

          {/* Footer links */}
          <div className="mt-6 text-center text-sm">
            <p className="text-muted">
              Already have an account?{' '}
              <Link
                href={ROUTES.PLATFORM.login}
                className="font-medium text-brand-600 hover:text-brand-500"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
