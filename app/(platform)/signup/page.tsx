import type { Metadata } from 'next'
import { Link } from 'next-view-transitions'
import Image from 'next/image'
import { SignupForm } from '@/components/auth/SignupForm'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Create teacher account — Skool Rooms',
  description: 'Create your Skool Rooms teacher account and start managing your courses.',
}

export default function SignupPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
          {/* Role badge */}
          <div className="mb-1 text-center text-xs font-medium uppercase tracking-wider text-primary">
            Teacher Account
          </div>
          {/* Brand */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <Image src="/icon.png" alt="Skool Rooms" width={40} height={40} className="rounded-lg" />
            <h1 className="text-2xl font-bold text-foreground">Skool Rooms</h1>
          </div>
          <p className="mt-[-1.5rem] mb-8 text-center text-sm text-muted-foreground">
            Start teaching online — get your branded subdomain and student dashboard
          </p>

          <SignupForm />

          {/* Footer links */}
          <div className="mt-6 flex flex-col items-center gap-3 text-sm">
            <p className="text-muted-foreground">
              Already have an account?{' '}
              <Link
                href={ROUTES.PLATFORM.teacherLogin}
                className="font-medium text-primary hover:text-primary/90"
              >
                Sign in
              </Link>
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Looking to enroll as a student? Use the invite link from your teacher.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
