import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Reset password — Lumscribe',
  description: 'Set a new password for your Lumscribe account.',
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-surface p-8 shadow-card">
          {/* Brand */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-ink">Lumscribe</h1>
            <p className="mt-1 text-sm text-muted">Set your new password</p>
          </div>

          <ResetPasswordForm />

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
