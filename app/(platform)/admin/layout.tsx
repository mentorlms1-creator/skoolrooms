/**
 * app/(platform)/admin/layout.tsx — Admin panel layout
 *
 * Server Component. Uses requireAdmin() guard to restrict access.
 * Renders AdminSidebar + main content area.
 */

import { requireAdmin } from '@/lib/auth/guards'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { UIProvider } from '@/providers/UIProvider'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // This redirects to /admin/login if not an admin user
  await requireAdmin()

  return (
    <UIProvider>
      <div className="flex min-h-dvh bg-paper">
        <AdminSidebar />
        <main className="flex-1 pt-14 md:ml-64 md:pt-0">
          <div className="mx-auto max-w-6xl p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </UIProvider>
  )
}
