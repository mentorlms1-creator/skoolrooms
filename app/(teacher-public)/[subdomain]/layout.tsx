/**
 * app/(teacher-public)/[subdomain]/layout.tsx — Teacher public subdomain layout
 * Minimal wrapper with "Powered by Lumscribe" footer.
 */

import Link from 'next/link'
import { ROUTES } from '@/constants/routes'

export default function TeacherPublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <main className="flex-1">{children}</main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted">
        Powered by{' '}
        <Link
          href={ROUTES.PLATFORM.home}
          className="font-medium text-brand-600 hover:underline"
        >
          Lumscribe
        </Link>
      </footer>
    </div>
  )
}
