'use client'

/**
 * components/student/StudentNav.tsx — Top navigation bar for student portal
 *
 * Students get a top nav (not sidebar) per architecture.
 * Items: My Courses, Schedule, Payments, Settings
 * Brand name on left, Sign Out on right.
 */

import { useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { signOutStudent } from '@/lib/auth/actions'

// -----------------------------------------------------------------------------
// Nav item type
// -----------------------------------------------------------------------------

type NavItem = {
  label: string
  href: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: ROUTES.STUDENT.dashboard },
  { label: 'My Courses', href: ROUTES.STUDENT.courses },
  { label: 'Schedule', href: ROUTES.STUDENT.schedule },
  { label: 'Payments', href: ROUTES.STUDENT.payments },
  { label: 'Settings', href: ROUTES.STUDENT.settings },
]

// -----------------------------------------------------------------------------
// StudentNav component
// -----------------------------------------------------------------------------

export function StudentNav() {
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  function isActive(href: string): boolean {
    if (href === ROUTES.STUDENT.dashboard) {
      return pathname === href || pathname === '/student' || pathname === '/student/'
    }
    return pathname.startsWith(href)
  }

  function handleSignOut() {
    startTransition(() => {
      void signOutStudent()
    })
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link
          href={ROUTES.STUDENT.dashboard}
          className="text-lg font-bold text-brand-600"
        >
          Lumscribe
        </Link>

        {/* Desktop nav items */}
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  px-3 py-2 text-sm font-medium transition-colors
                  ${
                    active
                      ? 'border-b-2 border-brand-600 text-brand-600'
                      : 'text-muted hover:text-ink'
                  }
                `}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Desktop Sign Out */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isPending}
          className="hidden text-sm font-medium text-muted hover:text-ink transition-colors disabled:opacity-50 sm:block"
        >
          {isPending ? 'Signing out...' : 'Sign Out'}
        </button>

        {/* Mobile hamburger — <details>/<summary> for iOS compatibility */}
        <details className="sm:hidden group">
          <summary
            className="inline-flex min-h-[2.75rem] min-w-[2.75rem] cursor-pointer list-none items-center justify-center rounded-md p-2 text-muted hover:text-ink active:bg-brand-50 transition-colors [&::-webkit-details-marker]:hidden"
            aria-label="Toggle navigation menu"
          >
            <svg className="h-6 w-6 group-open:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg className="hidden h-6 w-6 group-open:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </summary>

          <nav className="absolute left-0 right-0 border-t border-border bg-surface px-4 pb-4 pt-2">
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-brand-50 text-brand-600'
                        : 'text-muted hover:text-ink active:bg-brand-50'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isPending}
                className="rounded-md px-3 py-2.5 text-left text-sm font-medium text-muted hover:text-ink active:bg-brand-50 transition-colors disabled:opacity-50"
              >
                {isPending ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </nav>
        </details>
      </div>
    </header>
  )
}
