import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { SignupForm } from '@/components/auth/SignupForm'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Create account — Skool Rooms',
  description: 'Create your Skool Rooms teacher account and start managing your courses.',
}

export default function SignupPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
          {/* Brand */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <Image src="/icon.png" alt="Skool Rooms" width={40} height={40} className="rounded-lg" />
            <h1 className="text-2xl font-bold text-foreground">Skool Rooms</h1>
          </div>
          <p className="mt-[-1.5rem] mb-8 text-center text-sm text-muted-foreground">
            Create your teacher account
          </p>

          <SignupForm />

          {/* Footer links */}
          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">
              Already have an account?{' '}
              <Link
                href={ROUTES.PLATFORM.login}
                className="font-medium text-primary hover:text-primary/90"
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
