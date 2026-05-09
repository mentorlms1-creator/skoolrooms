/**
 * PublicNavbar — Marketing site header.
 *
 * Server Component. Detects the visitor's session and swaps the
 * "Log In / Start Free" CTA pair for a single "Go to Dashboard" link when
 * a session exists, so logged-in users aren't asked to sign in again.
 */

import { Link } from 'next-view-transitions'
import Image from 'next/image'
import { ROUTES } from '@/constants/routes'
import { getSessionDestination } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { PublicNavbarMobile } from './PublicNavbarMobile'

export async function PublicNavbar() {
  const session = await getSessionDestination()

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href={ROUTES.PLATFORM.home} className="flex items-center gap-2">
          <Image src="/icon.png" alt="Skool Rooms" width={32} height={32} className="rounded-lg" />
          <span className="text-xl font-bold text-primary">Skool Rooms</span>
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
          {session ? (
            <Button asChild>
              <Link href={session.href}>{session.label}</Link>
            </Button>
          ) : (
            <>
              <Link
                href={ROUTES.PLATFORM.login}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Log In
              </Link>
              <Button asChild>
                <Link href={ROUTES.PLATFORM.signup}>Start Free</Link>
              </Button>
            </>
          )}
        </nav>

        {/* Mobile menu — Sheet provides native touch handling via Radix */}
        <PublicNavbarMobile session={session} />
      </div>
    </header>
  )
}
