'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

/**
 * PublicNavbar — Marketing site header.
 * Mobile menu uses shadcn Sheet (Radix Dialog) for native touch handling.
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
          <Button asChild>
            <Link href={ROUTES.PLATFORM.signup}>
              Start Free
            </Link>
          </Button>
        </nav>

        {/* Mobile menu — Sheet provides native touch handling via Radix */}
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
              <Link
                href={ROUTES.PLATFORM.login}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Log In
              </Link>
              <Button asChild className="mt-2">
                <Link href={ROUTES.PLATFORM.signup}>
                  Start Free
                </Link>
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
