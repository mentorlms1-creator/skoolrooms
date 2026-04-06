import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Reset password — Skool Rooms',
  description: 'Set a new password for your Skool Rooms account.',
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
          {/* Brand */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <Image src="/icon.png" alt="Skool Rooms" width={40} height={40} className="rounded-lg" />
            <h1 className="text-2xl font-bold text-foreground">Skool Rooms</h1>
          </div>
          <p className="mt-[-1.5rem] mb-8 text-center text-sm text-muted-foreground">Set your new password</p>

          <ResetPasswordForm />

          {/* Back to login */}
          <div className="mt-6 text-center text-sm">
            <Link
              href={ROUTES.PLATFORM.login}
              className="text-muted-foreground hover:text-foreground"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
