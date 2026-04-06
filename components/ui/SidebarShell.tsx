'use client'

/**
 * components/ui/SidebarShell.tsx — Unified sidebar layout for all roles.
 *
 * Uses shadcn Sidebar primitives (SidebarProvider, Sidebar, SidebarInset)
 * with Sheet-based mobile drawer. Active state via usePathname().
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Search } from 'lucide-react'
import type { NavItem } from '@/constants/nav-items'
import { cn } from '@/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { NotificationBell } from '@/components/ui/NotificationBell'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

type SidebarShellProps = {
  navItems: NavItem[]
  user: { name: string; role: string }
  roleBadge?: string | null
  notificationCount?: number
  notificationHref?: string
  signOutAction: () => Promise<void>
  children: React.ReactNode
}

export function SidebarShell({
  navItems,
  user,
  roleBadge,
  notificationCount = 0,
  notificationHref,
  signOutAction,
  children,
}: SidebarShellProps) {
  const pathname = usePathname()

  function isActive(href: string): boolean {
    // Dashboard routes: exact match only to avoid matching all sub-routes
    if (href === '/dashboard' || href === '/admin' || href === '/student') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <SidebarProvider>
      <Sidebar>
        {/* Header: Logo + role badge */}
        <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-primary">Lumscribe</span>
              {roleBadge && (
                <span className="rounded bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                  {roleBadge}
                </span>
              )}
            </div>
            {notificationHref && (
              <NotificationBell count={notificationCount} href={notificationHref} />
            )}
          </div>
        </SidebarHeader>

        {/* Search trigger (wired to command palette in Task 13) */}
        <SidebarGroup className="px-3 pt-3 pb-0">
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar px-3 py-2",
              "text-sm text-muted-foreground hover:bg-sidebar-accent transition-colors"
            )}
          >
            <Search className="h-4 w-4" />
            <span>Search...</span>
            <kbd className="ml-auto hidden rounded border border-sidebar-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
              Ctrl+K
            </kbd>
          </button>
        </SidebarGroup>

        {/* Navigation items */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarSeparator />

        {/* Footer: Theme toggle + user info + Sign Out */}
        <SidebarFooter className="px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col min-w-0">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {user.name}
              </span>
              <span className="truncate text-xs text-muted-foreground capitalize">
                {user.role}
              </span>
            </div>
            <ThemeToggle />
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </form>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {/* Mobile top bar with hamburger trigger */}
        <header className="flex h-14 items-center gap-2 border-b border-border px-4 md:hidden">
          <SidebarTrigger />
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-primary">Lumscribe</span>
            {roleBadge && (
              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-xs font-medium text-primary">
                {roleBadge}
              </span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {notificationHref && (
              <NotificationBell count={notificationCount} href={notificationHref} />
            )}
            <ThemeToggle />
          </div>
        </header>

        {/* Main content */}
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
