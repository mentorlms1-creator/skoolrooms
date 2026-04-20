import type { Metadata } from 'next'
import { Link } from 'next-view-transitions'
import Image from 'next/image'
import { Search } from 'lucide-react'
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

          {/* New student callout */}
          <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Search className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Don&apos;t have an account yet?
                </p>
                <p className="text-xs text-muted-foreground">
                  You don&apos;t need to sign up first. Open the invite link from your teacher to enroll, or{' '}
                  <Link
                    href={ROUTES.PLATFORM.explore}
                    className="font-medium text-primary hover:text-primary/90"
                  >
                    browse teachers
                  </Link>{' '}
                  to find one.
                </p>
              </div>
            </div>
          </div>

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
