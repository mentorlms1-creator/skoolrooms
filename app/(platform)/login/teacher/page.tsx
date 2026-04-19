import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { LoginForm } from '@/components/auth/LoginForm'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Teacher Sign in — Skool Rooms',
  description: 'Sign in to your Skool Rooms teacher dashboard.',
}

export default function TeacherLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
          {/* Role badge */}
          <div className="mb-1 text-center text-xs font-medium uppercase tracking-wider text-primary">
            Teacher Dashboard
          </div>
          {/* Brand */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <Image src="/icon.png" alt="Skool Rooms" width={40} height={40} className="rounded-lg" />
            <h1 className="text-2xl font-bold text-foreground">Skool Rooms</h1>
          </div>
          <p className="mt-[-1.5rem] mb-8 text-center text-sm text-muted-foreground">
            Sign in to manage your courses and students
          </p>

          <LoginForm action="teacher" redirectTo={ROUTES.TEACHER.dashboard} />

          {/* Footer links */}
          <div className="mt-6 flex flex-col items-center gap-3 text-sm">
            <p className="text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link
                href={ROUTES.PLATFORM.signup}
                className="font-medium text-primary hover:text-primary/90"
              >
                Create account
              </Link>
            </p>
            <Link
              href={ROUTES.PLATFORM.login}
              className="text-muted-foreground hover:text-foreground"
            >
              Not a teacher? Choose a different role
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
