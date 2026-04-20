import type { Metadata } from 'next'
import { Link } from 'next-view-transitions'
import Image from 'next/image'
import { GraduationCap, BookOpen, ArrowRight } from 'lucide-react'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Sign in — Skool Rooms',
  description: 'Sign in to Skool Rooms as a teacher or a student.',
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm sm:p-10">
          {/* Brand */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <Image src="/icon.png" alt="Skool Rooms" width={40} height={40} className="rounded-lg" />
            <h1 className="text-2xl font-bold text-foreground">Skool Rooms</h1>
          </div>
          <p className="mb-8 text-center text-sm text-muted-foreground">
            How would you like to sign in?
          </p>

          {/* Role picker */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href={ROUTES.PLATFORM.teacherLogin}
              className="group flex flex-col items-start gap-3 rounded-lg border border-border bg-background p-6 transition-colors hover:border-primary hover:bg-accent"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-foreground">I&apos;m a Teacher</div>
                <p className="text-sm text-muted-foreground">
                  Manage your courses, cohorts, students, and earnings.
                </p>
              </div>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                Continue as teacher
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>

            <Link
              href={ROUTES.PLATFORM.studentLogin}
              className="group flex flex-col items-start gap-3 rounded-lg border border-border bg-background p-6 transition-colors hover:border-primary hover:bg-accent"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-foreground">I&apos;m a Student</div>
                <p className="text-sm text-muted-foreground">
                  Already enrolled? Sign in to access your courses.
                </p>
              </div>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                Continue as student
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>

          {/* New student callout */}
          <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4 text-center">
            <p className="text-sm font-medium text-foreground">
              New student? You don&apos;t need to sign up first.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Open the invite link from your teacher to enroll, or{' '}
              <Link
                href={ROUTES.PLATFORM.explore}
                className="font-medium text-primary hover:text-primary/90"
              >
                browse teachers
              </Link>{' '}
              to find one.
            </p>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">
              Want to teach on Skool Rooms?{' '}
              <Link
                href={ROUTES.PLATFORM.signup}
                className="font-medium text-primary hover:text-primary/90"
              >
                Create a teacher account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
