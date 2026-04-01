'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'

export function PublicNavbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href={ROUTES.PLATFORM.home} className="text-xl font-bold text-brand-600">
          Lumscribe
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 sm:flex">
          <Link
            href={ROUTES.PLATFORM.explore}
            className="text-sm font-medium text-muted hover:text-ink"
          >
            Find a Teacher
          </Link>
          <Link
            href={ROUTES.PLATFORM.pricing}
            className="text-sm font-medium text-muted hover:text-ink"
          >
            Pricing
          </Link>
          <Link
            href={ROUTES.PLATFORM.login}
            className="text-sm font-medium text-muted hover:text-ink"
          >
            Log In
          </Link>
          <Link
            href={ROUTES.PLATFORM.signup}
            className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition-colors"
          >
            Start Free
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-muted hover:text-ink sm:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation menu"
        >
          {menuOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="border-t border-border px-4 pb-4 pt-2 sm:hidden">
          <div className="flex flex-col gap-3">
            <Link
              href={ROUTES.PLATFORM.explore}
              className="text-sm font-medium text-muted hover:text-ink"
              onClick={() => setMenuOpen(false)}
            >
              Find a Teacher
            </Link>
            <Link
              href={ROUTES.PLATFORM.pricing}
              className="text-sm font-medium text-muted hover:text-ink"
              onClick={() => setMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link
              href={ROUTES.PLATFORM.login}
              className="text-sm font-medium text-muted hover:text-ink"
              onClick={() => setMenuOpen(false)}
            >
              Log In
            </Link>
            <Link
              href={ROUTES.PLATFORM.signup}
              className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Start Free
            </Link>
          </div>
        </nav>
      )}
    </header>
  )
}
