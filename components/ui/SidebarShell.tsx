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
  ctaHref = '#',
  signOutAction,
  children,
}: SidebarShellProps) {
  const navItems = NAV_ITEMS_BY_ROLE[role] || []
  const pathname = usePathname()
  const { open: openCommandPalette } = useCommandPalette()
  const navGroups = groupNavItems(navItems)

  function isActive(href: string): boolean {
    if (href === '/dashboard' || href === '/admin' || href === '/student') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    /* Layer 1: White page background */
    <div className="min-h-dvh bg-card p-2 sm:p-4 font-sans text-foreground">
      {/* Layer 2: Subtle gray bento container */}
      <div className="flex min-h-[calc(100dvh-16px)] sm:min-h-[calc(100dvh-32px)] rounded-[2.5rem] bg-container overflow-hidden">
        <SidebarProvider>
          <Sidebar variant="floating" className="border-none bg-card">
            {/* Header: Logo */}
            <SidebarHeader className="px-6 pt-8 pb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    className="h-6 w-6"
                  >
                    <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
                    <path
                      d="M12 5v14M5 12h14"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <span className="text-2xl font-bold tracking-tight">Lumscribe</span>
              </div>
            </SidebarHeader>

            {/* Navigation items */}
            <SidebarContent className="px-4">
              {navGroups.map((group, groupIdx) => (
                <SidebarGroup key={group.label ?? `main-${groupIdx}`} className="mb-4">
                  {group.label && (
                    <SidebarGroupLabel className="px-4 mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50">
                      {group.label}
                    </SidebarGroupLabel>
                  )}
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-1">
                      {group.items.map((item) => {
                        const active = isActive(item.href)
                        return (
                          <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton
                              asChild
                              isActive={active}
                              className={cn(
                                "flex items-center gap-3 h-11 px-4 rounded-xl transition-all duration-200",
                                active 
                                  ? "bg-card shadow-sm ring-1 ring-foreground/5 text-foreground font-semibold"
                                  : "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground"
                              )}
                            >
                              <Link href={item.href}>
                                <item.icon className={cn("h-[22px] w-[22px]", active ? "text-foreground" : "text-muted-foreground")} strokeWidth={1.5} />
                                <span className="text-[15px]">{item.label}</span>
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

            <SidebarSeparator className="mx-6 bg-foreground/[0.05]" />

            {/* Footer: Sign Out */}
            <SidebarFooter className="p-4 pb-8">
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground transition-all duration-200"
                >
                  <LogOut className="h-5 w-5 rotate-180" strokeWidth={1.5} />
                  <span>Logout</span>
                </button>
              </form>
            </SidebarFooter>
          </Sidebar>

          <SidebarInset className="bg-transparent">
            <div className="flex-1 flex flex-col min-h-0 gap-3 p-3">
              {/* Desktop top bar — its own white bento */}
              <div className="hidden md:block rounded-3xl bg-card px-8 py-5">
                <div className="flex items-center justify-between gap-8">
                  {/* Left: Search box */}
                  <div className="relative flex-1 max-w-xl bg-card rounded-2xl shadow-sm ring-1 ring-foreground/5 flex items-center px-4 py-1.5 has-[:focus]:ring-foreground/10 transition-shadow">
                    <Search className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
                    <button
                      type="button"
                      onClick={openCommandPalette}
                      className="flex-1 px-3 py-2 text-[15px] text-muted-foreground text-left focus:outline-none"
                    >
                      Search or type a command
                    </button>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <kbd className="flex h-7 items-center gap-1 rounded bg-foreground/[0.05] px-1.5 font-mono text-[11px] font-semibold text-muted-foreground">
                        <span className="text-[14px]">⌘</span>
                        <span>F</span>
                      </kbd>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                       <ThemeToggle />
                       <button className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card shadow-sm ring-1 ring-foreground/5 text-muted-foreground hover:text-foreground transition-colors relative">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                             <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9m12 9H6m4 4h4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-accent ring-2 ring-card" />
                       </button>
                    </div>
                    
                    <button className="h-11 w-11 rounded-2xl overflow-hidden shadow-sm ring-2 ring-card">
                      <img
                        src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex"
                        alt="User avatar"
                        className="h-full w-full object-cover bg-accent/20"
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile top bar */}
              <header className="flex h-16 items-center gap-3 bg-card px-6 md:hidden">
                <SidebarTrigger className="h-10 w-10 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-foreground text-background flex items-center justify-center">
                    <span className="text-xl font-bold">L</span>
                  </div>
                  <span className="text-xl font-bold">Lumscribe</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <ThemeToggle />
                </div>
              </header>

              {/* Main content — its own white bento */}
              <main className="flex-1 overflow-y-auto rounded-3xl bg-card px-8 py-8 custom-scrollbar">
                <div className="mx-auto w-full max-w-7xl">
                  {children}
                </div>
              </main>
            </div>
          </SidebarInset>

          <CommandPalette navItems={navItems} />
        </SidebarProvider>
      </div>
    </div>
  )
}
