/**
 * app/(platform)/page.tsx — Marketing homepage for lumscribe.com
 * Server Component. Hero, features, and footer.
 */

import Link from 'next/link'
import { ROUTES } from '@/constants/routes'
import { PublicNavbar } from '@/components/public/PublicNavbar'

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-background">
      {/* ── Header ── */}
      <PublicNavbar />

      <main>
      {/* ── Hero ── */}
      <section className="mx-auto max-w-4xl px-4 py-12 sm:py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Your Teaching, Your Brand, One Platform
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Lumscribe gives independent tutors and coaching centers a branded LMS
          with course management, scheduling, payments, and a public profile
          &mdash; all in one place.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href={ROUTES.PLATFORM.signup}
            className="inline-flex items-center rounded-md bg-primary px-6 py-3 text-base font-medium text-white hover:bg-primary/90 transition-colors"
          >
            Start Free
          </Link>
          <Link
            href={ROUTES.PLATFORM.explore}
            className="inline-flex items-center rounded-md border border-primary bg-transparent px-6 py-3 text-base font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            Find a Teacher
          </Link>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="border-t border-border bg-card py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold text-foreground">
            Everything you need to teach online
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Set up in minutes. No coding, no hassle.
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border border-border bg-background p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  {feature.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-background py-8 text-center text-sm text-muted-foreground">
        Lumscribe &mdash; LMS for Tutors
      </footer>
    </div>
  )
}

// ── Feature data ──

type Feature = {
  title: string
  description: string
  icon: React.ReactNode
}

const FEATURES: Feature[] = [
  {
    title: 'Branded Subdomain',
    description:
      'Get your own yourname.lumscribe.com page where students can discover your courses and enroll instantly.',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    title: 'Course Management',
    description:
      'Create courses, organize cohorts, set schedules, track attendance, and share materials from one dashboard.',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
      </svg>
    ),
  },
  {
    title: 'Simple Payments',
    description:
      'Students pay via bank transfer, JazzCash, or EasyPaisa. You verify screenshot receipts and get paid directly.',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
        <path
          fillRule="evenodd"
          d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
]
