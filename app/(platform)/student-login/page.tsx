import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { LoginForm } from '@/components/auth/LoginForm'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Student Sign in — Skool Rooms',
  description: 'Sign in to the Skool Rooms student portal.',
}

export default function StudentLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
          {/* Brand */}
          <div className="mb-1 text-center text-xs font-medium uppercase tracking-wider text-primary">
            Student Portal
          </div>
          <div className="flex items-center justify-center gap-2 mb-8">
            <Image src="/icon.png" alt="Skool Rooms" width={40} height={40} className="rounded-lg" />
            <h1 className="text-2xl font-bold text-foreground">Skool Rooms</h1>
          </div>
          <p className="mt-[-1.5rem] mb-8 text-center text-sm text-muted-foreground">
            Sign in to access your courses
          </p>

          <LoginForm action="student" redirectTo="/student" />

          {/* Footer links */}
          <div className="mt-6 flex flex-col items-center gap-3 text-sm">
            <Link
              href={ROUTES.PLATFORM.teacherLogin}
              className="text-muted-foreground hover:text-foreground"
            >
              Sign in as a teacher instead
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
