/**
 * app/(platform)/admin/layout.tsx — Admin panel layout
 *
 * Server Component. Uses requireAdmin() guard to restrict access.
 * Renders AdminSidebar + main content area.
 */

import { requireAdmin } from '@/lib/auth/guards'
import { SidebarShell } from '@/components/ui/SidebarShell'
import { UIProvider } from '@/providers/UIProvider'
import { signOut } from '@/lib/auth/actions'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // This redirects to /admin/login if not an admin user
  await requireAdmin()

  return (
    <UIProvider>
      <SidebarShell
        role="admin"
        user={{ name: 'Admin' }}
        roleBadge="Admin"
        signOutAction={signOut}
      >
        {children}
      </SidebarShell>
    </UIProvider>
  )
}
