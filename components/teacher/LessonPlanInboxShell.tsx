// =============================================================================
// components/teacher/LessonPlanInboxShell.tsx
//
// Three-pane shell for the lesson plan workspace:
//   • Left  — recent plans sidebar (LessonPlanSidebarList) with compose button
//   • Mid   — the plan detail (or empty hint when no plan selected)
//   • Right — AI revise panel (LessonPlanChat) when a plan is open
//
// Server Component. The list/chat/dialog inside it are client components and
// hydrate independently.
// =============================================================================

import { FileText, SlidersHorizontal } from 'lucide-react'
import { LessonPlanSidebarList, type LessonPlanSidebarItem } from './LessonPlanSidebarList'
import { NewLessonPlanDialog } from './NewLessonPlanDialog'
import { cn } from '@/lib/utils'

type LessonPlanInboxShellProps = {
  courseId: string
  plans: LessonPlanSidebarItem[]
  totalCount: number
  quotaText: string
  canCreate: boolean
  disabledReason: string
  /** Right-pane (plan detail + AI panel). When omitted, the shell renders an
   *  empty hint nudging the teacher to pick or create a plan. */
  children?: React.ReactNode
}

export function LessonPlanInboxShell({
  courseId,
  plans,
  totalCount,
  quotaText,
  canCreate,
  disabledReason,
  children,
}: LessonPlanInboxShellProps) {
  return (
    <div className="h-[calc(100dvh-9rem)] md:h-[calc(100dvh-13rem)] min-h-[520px]">
      <div className="h-full bg-card rounded-3xl ring-1 ring-foreground/5 shadow-sm overflow-hidden">
        <div className="flex h-full">
          {/* ── Sidebar list ────────────────────────────────────────────── */}
          <aside
            className={cn(
              'flex flex-col border-r border-foreground/[0.05] shrink-0',
              'w-full md:w-[320px] lg:w-[340px]',
              children ? 'hidden md:flex' : 'flex',
            )}
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold tracking-tight">Lesson Plans</h2>
                <p className="text-[11.5px] text-muted-foreground/80 mt-0.5">
                  {totalCount} {totalCount === 1 ? 'plan' : 'plans'}
                  <span className="mx-1.5 opacity-50">·</span>
                  {quotaText}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <NewLessonPlanDialog
                  courseId={courseId}
                  disabled={!canCreate}
                  disabledReason={disabledReason}
                  trigger={
                    <button
                      type="button"
                      aria-label="New lesson plan"
                      title={!canCreate ? disabledReason : 'New lesson plan'}
                      disabled={!canCreate}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <PlusIcon />
                    </button>
                  }
                />
                <button
                  type="button"
                  aria-label="Filter (coming soon)"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.05] text-muted-foreground hover:bg-foreground/[0.08] transition-colors"
                  disabled
                  title="Filters coming soon"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <LessonPlanSidebarList courseId={courseId} plans={plans} />
            </div>
          </aside>

          {/* ── Right pane ──────────────────────────────────────────────── */}
          <section
            className={cn(
              'flex-1 flex flex-col min-w-0 bg-card',
              children ? 'flex' : 'hidden md:flex',
            )}
          >
            {children ?? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-sm">
                  <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground/[0.04]">
                    <FileText className="h-7 w-7 text-muted-foreground/60" strokeWidth={1.5} />
                  </div>
                  <p className="text-base font-semibold text-foreground">
                    No lesson plan selected
                  </p>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    {plans.length === 0
                      ? 'Generate your first AI lesson plan to get started.'
                      : 'Pick a plan from the left to view, revise, or export.'}
                  </p>
                  {plans.length === 0 && canCreate && (
                    <div className="mt-5 inline-flex">
                      <NewLessonPlanDialog
                        courseId={courseId}
                        disabled={!canCreate}
                        disabledReason={disabledReason}
                        trigger={
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                          >
                            <PlusIcon />
                            Generate first plan
                          </button>
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
