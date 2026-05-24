// =============================================================================
// components/admin/ConversionFunnel.tsx
// 4-step lifecycle funnel for admin dashboard: signed up → created cohort →
// got enrollment → got payment. Each bar's width is proportional to the top
// of the funnel; drop-off % is computed vs the previous stage.
// =============================================================================

import type { ConversionFunnel } from '@/lib/db/admin-dashboard'

type Stage = {
  key: keyof ConversionFunnel
  label: string
  hint: string
}

const STAGES: Stage[] = [
  { key: 'signed_up', label: 'Signed up', hint: 'All teacher accounts' },
  { key: 'created_cohort', label: 'Created a cohort', hint: 'Set up at least one class' },
  { key: 'got_enrollment', label: 'Got an enrollment', hint: 'At least one student joined' },
  { key: 'got_payment', label: 'Got a paid student', hint: 'Confirmed payment received' },
]

export function ConversionFunnelWidget({ data }: { data: ConversionFunnel }) {
  const top = Math.max(data.signed_up, 1)

  return (
    <div className="space-y-4">
      {STAGES.map((stage, i) => {
        const count = data[stage.key]
        const widthPct = Math.max(6, Math.round((count / top) * 100))
        const prev = i === 0 ? null : data[STAGES[i - 1].key]
        const dropPct = prev !== null && prev > 0
          ? Math.round(((prev - count) / prev) * 100)
          : null

        return (
          <div key={stage.key}>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-foreground truncate">
                  {stage.label}
                </p>
                <p className="text-[11px] text-muted-foreground/70 truncate">{stage.hint}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[15px] font-extrabold tracking-tight tabular-nums text-foreground">
                  {count}
                </span>
                {dropPct !== null && dropPct > 0 && (
                  <span className="ml-2 text-[11px] font-semibold tabular-nums text-destructive/80">
                    −{dropPct}%
                  </span>
                )}
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-foreground/[0.04] overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${widthPct}%`,
                  opacity: 1 - i * 0.18,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
