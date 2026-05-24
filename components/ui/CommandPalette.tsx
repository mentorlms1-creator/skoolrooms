'use client'

/**
 * components/ui/CommandPalette.tsx -- Cmd+K command palette.
 *
 * Provides quick navigation to all sidebar pages plus theme toggling.
 * Accepts navItems from the parent SidebarShell so it works for any role.
 *
 * Optional `searchAction` prop: when provided, the palette debounces the
 * input and calls the action to populate a "Search results" group above
 * the nav items. Used by admin to search teachers / students / cohorts.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Moon, Sun, GraduationCap, User as UserIcon, Users as UsersIcon, Loader2 } from 'lucide-react'
import type { NavItem } from '@/constants/nav-items'

export type AdminSearchHit = {
  type: 'teacher' | 'student' | 'cohort'
  id: string
  label: string
  sublabel: string | null
  href: string
}

type CommandPaletteProps = {
  navItems: NavItem[]
  /**
   * Optional async search action. When provided, the palette runs it on
   * input (debounced) and renders matches as a "Search results" group.
   */
  searchAction?: (query: string) => Promise<AdminSearchHit[]>
}

const TYPE_META: Record<
  AdminSearchHit['type'],
  { icon: typeof UserIcon; label: string }
> = {
  teacher: { icon: GraduationCap, label: 'Teacher' },
  student: { icon: UserIcon, label: 'Student' },
  cohort: { icon: UsersIcon, label: 'Cohort' },
}

export function CommandPalette({ navItems, searchAction }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<AdminSearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { setTheme, theme } = useTheme()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqIdRef = useRef(0)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Debounced server search. Stale results discarded via reqIdRef.
  useEffect(() => {
    if (!searchAction || !open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setHits([])
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const reqId = ++reqIdRef.current
      try {
        const results = await searchAction(trimmed)
        if (reqId === reqIdRef.current) {
          setHits(results)
        }
      } catch {
        if (reqId === reqIdRef.current) {
          setHits([])
        }
      } finally {
        if (reqId === reqIdRef.current) {
          setLoading(false)
        }
      }
    }, 220)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open, searchAction])

  // Reset when the palette closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setHits([])
      setLoading(false)
    }
  }, [open])

  const handleSelect = useCallback(
    (href: string) => {
      router.push(href)
      setOpen(false)
    },
    [router],
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder={
          searchAction
            ? 'Search teachers, students, cohorts, or jump to a page...'
            : 'Type a command or search...'
        }
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? (
            <span className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching…
            </span>
          ) : (
            'No results found.'
          )}
        </CommandEmpty>

        {hits.length > 0 && (
          <>
            <CommandGroup heading="Search results">
              {hits.map((hit) => {
                const meta = TYPE_META[hit.type]
                const Icon = meta.icon
                return (
                  <CommandItem
                    key={`${hit.type}:${hit.id}`}
                    value={`${hit.label} ${hit.sublabel ?? ''} ${meta.label}`}
                    onSelect={() => handleSelect(hit.href)}
                  >
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{hit.label}</span>
                    {hit.sublabel && (
                      <span className="ml-2 text-xs text-muted-foreground truncate">
                        {hit.sublabel}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {meta.label}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Pages">
          {navItems.map((item) => (
            <CommandItem
              key={item.href}
              onSelect={() => handleSelect(item.href)}
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              setTheme(theme === 'dark' ? 'light' : 'dark')
              setOpen(false)
            }}
          >
            {theme === 'dark' ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            Toggle Dark Mode
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

/**
 * Hook to programmatically open the command palette.
 * Dispatches the same Ctrl+K / Cmd+K event the palette listens for.
 */
export function useCommandPalette() {
  const open = useCallback(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
      }),
    )
  }, [])

  return { open }
}
