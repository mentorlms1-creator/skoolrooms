'use client'

/**
 * components/student/StudentNav.tsx — Top navigation bar for student portal
 *
 * Students get a top nav (not sidebar) per architecture.
 * Items: My Courses, Schedule, Payments, Settings
 * Brand name on left, Sign Out on right.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTransition } from 'react'
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

        {/* Nav items */}
        <nav className="flex items-center gap-1">
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

        {/* Sign Out */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isPending}
          className="text-sm font-medium text-muted hover:text-ink transition-colors disabled:opacity-50"
        >
          {isPending ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </header>
  )
}
