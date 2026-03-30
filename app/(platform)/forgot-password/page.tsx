import type { Metadata } from 'next'
import Link from 'next/link'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Forgot password — Lumscribe',
  description: 'Reset your Lumscribe account password.',
}

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-surface p-8 shadow-card">
          {/* Brand */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-ink">Lumscribe</h1>
            <p className="mt-1 text-sm text-muted">Reset your password</p>
          </div>

          <ForgotPasswordForm />

          {/* Back to login */}
          <div className="mt-6 text-center text-sm">
            <Link
              href={ROUTES.PLATFORM.login}
              className="text-muted hover:text-ink"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
