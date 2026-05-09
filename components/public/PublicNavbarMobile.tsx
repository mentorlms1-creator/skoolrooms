'use client'

import { Link } from 'next-view-transitions'
import { Menu } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import type { SessionDestination } from '@/lib/auth/session'

type PublicNavbarMobileProps = {
  session: SessionDestination | null
}

export function PublicNavbarMobile({ session }: PublicNavbarMobileProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="sm:hidden">
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-64">
        <nav className="flex flex-col gap-4 mt-8">
          <Link
            href={ROUTES.PLATFORM.explore}
            className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Find a Teacher
          </Link>
          <Link
            href={ROUTES.PLATFORM.pricing}
            className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Pricing
          </Link>
          {session ? (
            <Button asChild className="mt-2">
              <Link href={session.href}>{session.label}</Link>
            </Button>
          ) : (
            <>
              <Link
                href={ROUTES.PLATFORM.login}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Log In
              </Link>
              <Button asChild className="mt-2">
                <Link href={ROUTES.PLATFORM.signup}>Start Free</Link>
              </Button>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
