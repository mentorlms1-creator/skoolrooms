'use client'

/**
 * components/ui/SidebarShell.tsx — Unified sidebar layout for all roles.
 *
 * Uses shadcn Sidebar primitives (SidebarProvider, Sidebar, SidebarInset)
 * with Sheet-based mobile drawer. Active state via usePathname().
 *
 * Sidebar renders as a floating bento card with rounded corners and margin,
 * exposing the cool gray page background around all edges.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Search } from 'lucide-react'
import { TEACHER_NAV_ITEMS, ADMIN_NAV_ITEMS, STUDENT_NAV_ITEMS, type NavItem } from '@/constants/nav-items'

const NAV_ITEMS_BY_ROLE: Record<string, NavItem[]> = {
  teacher: TEACHER_NAV_ITEMS,
  admin: ADMIN_NAV_ITEMS,
  student: STUDENT_NAV_ITEMS,
}
import { cn } from '@/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
import { CommandPalette, useCommandPalette } from '@/components/ui/CommandPalette'

type SidebarShellProps = {
  role: 'teacher' | 'admin' | 'student'
  user: { name: string }
  roleBadge?: string | null
  notificationCount?: number
  notificationHref?: string
  signOutAction: () => Promise<void>
  children: React.ReactNode
}

/** Group nav items: items without a group come first, then grouped by label */
function groupNavItems(items: NavItem[]): { label: string | null; items: NavItem[] }[] {
  const groups: { label: string | null; items: NavItem[] }[] = []
  let currentGroup: string | null | undefined = undefined

  for (const item of items) {
    const group = item.group ?? null
    if (group !== currentGroup) {
      groups.push({ label: group, items: [item] })
      currentGroup = group
    } else {
      groups[groups.length - 1].items.push(item)
    }
  }

  return groups
}

export function SidebarShell({
  role,
  user,
  roleBadge,
  notificationCount = 0,
  notificationHref,
  signOutAction,
  children,
}: SidebarShellProps) {
  const navItems = NAV_ITEMS_BY_ROLE[role] || []
  const pathname = usePathname()
  const { open: openCommandPalette } = useCommandPalette()
  const navGroups = groupNavItems(navItems)

  function isActive(href: string): boolean {
    // Dashboard routes: exact match only to avoid matching all sub-routes
    if (href === '/dashboard' || href === '/admin' || href === '/student') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <SidebarProvider>
      <Sidebar variant="floating">
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

        {/* Search trigger — styled as input field, opens CommandPalette (Cmd+K / Ctrl+K) */}
        <SidebarGroup className="px-3 pt-3 pb-0">
          <button
            type="button"
            onClick={openCommandPalette}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border border-border/40 bg-background px-3 py-2",
              "text-sm text-muted-foreground hover:bg-accent/50 transition-colors"
            )}
          >
            <Search className="h-4 w-4" strokeWidth={1.5} />
            <span className="flex-1 text-left">Search or type a command...</span>
            <kbd className="hidden rounded border border-border/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/60 sm:inline-block">
              Ctrl+K
            </kbd>
          </button>
        </SidebarGroup>

        {/* Navigation items — grouped with section labels */}
        <SidebarContent>
          {navGroups.map((group, groupIdx) => (
            <SidebarGroup key={group.label ?? `main-${groupIdx}`}>
              {group.label && (
                <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active = isActive(item.href)
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <Link href={item.href}>
                            <item.icon className="h-5 w-5" strokeWidth={1.5} />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
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
                {role}
              </span>
            </div>
            <ThemeToggle />
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
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

      <CommandPalette navItems={navItems} />
    </SidebarProvider>
  )
}
