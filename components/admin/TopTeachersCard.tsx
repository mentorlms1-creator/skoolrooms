// =============================================================================
// components/admin/TopTeachersCard.tsx
// Ranked list of teachers by lifetime gross student-payment volume. This is
// teacher revenue (not platform revenue) but is the strongest signal of
// "which teachers actually run a business on the platform."
// =============================================================================

import { Link } from 'next-view-transitions'
import { Trophy } from 'lucide-react'
import type { TopTeacherRow } from '@/lib/db/admin-dashboard'

function formatPkr(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function TopTeachersCard({ teachers }: { teachers: TopTeacherRow[] }) {
  if (teachers.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted-foreground">
          No teachers with paid students yet.
        </p>
      </div>
    )
  }

  return (
    <ol className="space-y-1.5">
      {teachers.map((t, i) => (
        <li key={t.teacher_id}>
          <Link
            href={`/admin/teachers/${t.teacher_id}`}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-foreground/[0.03] transition-colors"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.04] text-[12px] font-bold tabular-nums text-muted-foreground">
              {i === 0 ? <Trophy className="h-3.5 w-3.5 text-amber-500" /> : i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-foreground truncate group-hover:text-primary transition-colors">
                {t.name}
              </p>
              <p className="text-[11px] text-muted-foreground/70 truncate">
                {t.student_count} student{t.student_count === 1 ? '' : 's'}
                {' · '}
                <span className="capitalize">{t.plan}</span>
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[13px] font-extrabold tabular-nums text-foreground leading-none">
                PKR {formatPkr(t.lifetime_gross_pkr)}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mt-0.5">
                Lifetime
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  )
}
