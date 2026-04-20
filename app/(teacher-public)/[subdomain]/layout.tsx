/**
 * app/(teacher-public)/[subdomain]/layout.tsx — Teacher public subdomain layout
 * Minimal wrapper with "Powered by Skool Rooms" footer.
 */

import { Link } from 'next-view-transitions'
import { ROUTES } from '@/constants/routes'

export default function TeacherPublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="flex-1">{children}</main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        Powered by{' '}
        <Link
          href={ROUTES.PLATFORM.home}
          className="font-medium text-primary hover:underline"
        >
          Skool Rooms
        </Link>
      </footer>
    </div>
  )
}
