'use client'

import Link from 'next/link'
import { ROUTES } from '@/constants/routes'

/**
 * PublicNavbar — Marketing site header.
 * Mobile menu uses <details>/<summary> for progressive enhancement:
 * works instantly without JS (native HTML disclosure), then React hydrates.
 * This pattern is used by GitHub, GOV.UK, and other major sites.
 */
export function PublicNavbar() {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href={ROUTES.PLATFORM.home} className="text-xl font-bold text-primary">
          Lumscribe
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 sm:flex">
          <Link
            href={ROUTES.PLATFORM.explore}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Find a Teacher
          </Link>
          <Link
            href={ROUTES.PLATFORM.pricing}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Pricing
          </Link>
          <Link
            href={ROUTES.PLATFORM.login}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Log In
          </Link>
          <Link
            href={ROUTES.PLATFORM.signup}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 active:bg-primary/5 transition-colors"
          >
            Start Free
          </Link>
        </nav>

        {/* Mobile menu — <details>/<summary> is native HTML disclosure.
            Works before React hydrates. No JS required for open/close. */}
        <details className="sm:hidden group">
          <summary
            className="inline-flex min-h-[2.75rem] min-w-[2.75rem] cursor-pointer list-none items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground active:bg-primary/10 transition-colors [&::-webkit-details-marker]:hidden"
            aria-label="Toggle navigation menu"
          >
            {/* Hamburger icon — visible when closed */}
            <svg className="h-6 w-6 group-open:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            {/* X icon — visible when open */}
            <svg className="hidden h-6 w-6 group-open:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </summary>

          <nav className="absolute left-0 right-0 border-t border-border bg-card px-4 pb-4 pt-2">
            <div className="flex flex-col gap-1">
              <Link
                href={ROUTES.PLATFORM.explore}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground active:bg-primary/10 transition-colors"
              >
                Find a Teacher
              </Link>
              <Link
                href={ROUTES.PLATFORM.pricing}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground active:bg-primary/10 transition-colors"
              >
                Pricing
              </Link>
              <Link
                href={ROUTES.PLATFORM.login}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground active:bg-primary/10 transition-colors"
              >
                Log In
              </Link>
              <Link
                href={ROUTES.PLATFORM.signup}
                className="mt-1 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 active:bg-primary/5 transition-colors"
              >
                Start Free
              </Link>
            </div>
          </nav>
        </details>
      </div>
    </header>
  )
}
