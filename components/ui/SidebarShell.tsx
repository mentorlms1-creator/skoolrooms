'use client'

/**
 * components/ui/SidebarShell.tsx — Unified sidebar layout for all roles.
 *
 * Uses shadcn Sidebar primitives (SidebarProvider, Sidebar, SidebarInset)
 * with Sheet-based mobile drawer. Active state via usePathname().
 *
 * Three-layer visual hierarchy:
 * 1. White page background (visible at screen edges)
 * 2. Subtle gray "bento container" with large rounded corners (~98% viewport)
 * 3. White sidebar + white content cards floating inside the gray container
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Plus, Search } from 'lucide-react'
import { TEACHER_NAV_ITEMS, ADMIN_NAV_ITEMS, STUDENT_NAV_ITEMS, type NavItem } from '@/constants/nav-items'

const NAV_ITEMS_BY_ROLE: Record<string, NavItem[]> = {
  teacher: TEACHER_NAV_ITEMS,
  admin: ADMIN_NAV_ITEMS,
  student: STUDENT_NAV_ITEMS,
}
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
  ctaLabel?: string
  ctaHref?: string
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
  ctaLabel,
  ctaHref,
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
    /* Layer 1: White page background */
    <div className="min-h-dvh bg-background p-2 sm:p-3">
      {/* Layer 2: Subtle gray bento container */}
      <div className="flex min-h-[calc(100dvh-16px)] sm:min-h-[calc(100dvh-24px)] rounded-3xl bg-container">
        <SidebarProvider>
          <Sidebar variant="floating">
            {/* Header: Logo + role badge */}
            <SidebarHeader className="px-5 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-primary">Lumscribe</span>
                  {roleBadge && (
                    <span className="rounded bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                      {roleBadge}
                    </span>
                  )}
                </div>
              </div>
            </SidebarHeader>

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
            <div className="flex-1 px-3 pt-3 pb-3">
              {/* Desktop top bar — its own card */}
              <div className="mb-3 hidden rounded-3xl bg-card px-6 py-3 md:block">
                <div className="flex items-center justify-between">
                  {/* Left: Search trigger */}
                  <button
                    type="button"
                    onClick={openCommandPalette}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-4 py-2.5",
                      "text-sm text-muted-foreground hover:bg-accent/30 transition-colors min-w-[300px]"
                    )}
                  >
                    <Search className="h-4 w-4" strokeWidth={1.5} />
                    <span className="flex-1 text-left">Search or type a command</span>
                    <kbd className="rounded border border-border/30 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/50">
                      Ctrl+K
                    </kbd>
                  </button>

                  {/* Right: CTA + notification + avatar */}
                  <div className="flex items-center gap-3">
                    {ctaLabel && ctaHref && (
                      <Button asChild variant="default" size="sm" className="rounded-full bg-foreground text-background hover:bg-foreground/90 gap-1.5">
                        <Link href={ctaHref}>
                          <Plus className="h-4 w-4" />
                          {ctaLabel}
                        </Link>
                      </Button>
                    )}
                    {notificationHref && (
                      <NotificationBell count={notificationCount} href={notificationHref} />
                    )}
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>

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
              <div className="mx-auto w-full max-w-6xl px-3">
                {children}
              </div>
            </div>
          </SidebarInset>

          <CommandPalette navItems={navItems} />
        </SidebarProvider>
      </div>
    </div>
  )
}
