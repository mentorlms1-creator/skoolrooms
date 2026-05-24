'use client'

// =============================================================================
// components/teacher/LessonPlanSidebarList.tsx
//
// Inline list of lesson plans for the inbox-style detail page. Renders a
// scrollable list of plan cards with a thumbnail (themed gradient + first
// letter), title, duration/scope, and updated date. Active plan gets a soft
// pill background. Includes a local search input over the list.
// =============================================================================

import { useMemo, useState } from 'react'
import { Link } from 'next-view-transitions'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Search, MoreHorizontal, Trash2, FileText } from 'lucide-react'
import { formatPKT } from '@/lib/time/pkt'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'
import { deleteLessonPlanAction } from '@/lib/actions/lessonPlans'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type LessonPlanSidebarItem = {
  id: string
  title: string
  scope: 'session' | 'unit'
  updated_at: string
  /** Deterministic-but-varied avatar hue derived from the plan id. */
  themeIndex: number
}

type Props = {
  courseId: string
  plans: LessonPlanSidebarItem[]
}

// 8 OKLCH avatar palette tokens we already define in globals.css.
const AVATAR_TONES = ['avatar-1','avatar-2','avatar-3','avatar-4','avatar-5','avatar-6','avatar-7','avatar-8'] as const

export function LessonPlanSidebarList({ courseId, plans }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [pending, start] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return plans
    return plans.filter((p) => p.title.toLowerCase().includes(q))
  }, [query, plans])

  function onDelete(planId: string) {
    if (!confirm('Delete this lesson plan? This cannot be undone.')) return
    setDeletingId(planId)
    start(async () => {
      const res = await deleteLessonPlanAction({ planId, courseId })
      setDeletingId(null)
      if (!res.success) {
        toast.error("Couldn't delete", { description: res.error })
        return
      }
      // If we just deleted the open plan, go back to the list root.
      const detailHref = ROUTES.TEACHER.lessonPlanDetail(courseId, planId)
      if (pathname === detailHref) {
        router.push(ROUTES.TEACHER.courseLessonPlans(courseId))
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="flex h-full flex-col">
      {plans.length > 0 && (
        <div className="px-4 pt-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lesson plans"
              className="w-full rounded-xl bg-foreground/[0.04] pl-9 pr-3 py-2 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
            />
          </div>
        </div>
      )}

      <ul className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5 custom-scrollbar">
        {plans.length === 0 ? (
          <li className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <FileText className="h-9 w-9 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-foreground">No lesson plans yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
              Generate your first plan with AI using the + above.
            </p>
          </li>
        ) : filtered.length === 0 ? (
          <li className="px-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">No plans match &ldquo;{query}&rdquo;</p>
          </li>
        ) : (
          filtered.map((plan) => {
            const href = ROUTES.TEACHER.lessonPlanDetail(courseId, plan.id)
            const isActive = pathname === href
            const tone = AVATAR_TONES[plan.themeIndex % AVATAR_TONES.length]
            const initial = plan.title.trim().charAt(0).toUpperCase() || '·'

            return (
              <li key={plan.id}>
                <Link
                  href={href}
                  className={cn(
                    'group block rounded-2xl p-3 transition-colors',
                    isActive
                      ? 'bg-primary/[0.08] ring-1 ring-primary/15'
                      : 'hover:bg-foreground/[0.03]',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="h-12 w-12 shrink-0 rounded-xl flex items-center justify-center text-[15px] font-bold text-avatar-foreground"
                      style={{ background: `var(--${tone})` }}
                      aria-hidden
                    >
                      {initial}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p
                          className={cn(
                            'text-[13.5px] leading-snug line-clamp-2',
                            isActive ? 'font-bold text-foreground' : 'font-semibold text-foreground',
                          )}
                        >
                          {plan.title}
                        </p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                              }}
                              aria-label="Plan actions"
                              className={cn(
                                'shrink-0 -mr-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-foreground/[0.05] transition-opacity',
                                isActive && 'opacity-100',
                              )}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              disabled={pending && deletingId === plan.id}
                              onSelect={(e) => {
                                e.preventDefault()
                                onDelete(plan.id)
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete plan
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="mt-1 text-[11.5px] text-muted-foreground">
                        <span className="capitalize">{plan.scope}</span>
                        <span className="mx-1.5 opacity-50">·</span>
                        {formatPKT(plan.updated_at, 'date')}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
