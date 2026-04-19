'use client'

// PlanPreviewCard — live preview that updates as admin types (pure client state, no server round-trip)

import type { PlanRow } from '@/lib/db/admin-plans'
import { Check, X } from 'lucide-react'

type PlanPreviewValues = {
  name: string
  price_pkr: number
  max_courses: number
  max_students: number
  max_cohorts_active: number
  max_storage_mb: number
  max_teachers: number
  transaction_cut_percent: number
  trial_days: number
  features: Record<string, boolean>
}

export function PlanPreviewCard({ values }: { values: PlanPreviewValues }) {
  const {
    name,
    price_pkr,
    max_courses,
    max_students,
    max_cohorts_active,
    max_storage_mb,
    max_teachers,
    transaction_cut_percent,
    trial_days,
    features,
  } = values

  return (
    <div className="rounded-2xl ring-1 ring-foreground/10 p-6 space-y-4 bg-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Preview</p>
          <h3 className="mt-1 text-xl font-bold text-foreground">{name || 'Plan Name'}</h3>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-foreground">
            ₨{(price_pkr || 0).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">/month</p>
        </div>
      </div>

      {trial_days > 0 && (
        <p className="text-xs text-primary font-medium">{trial_days}-day free trial</p>
      )}

      <div className="space-y-1.5 text-sm">
        <LimitRow label="Courses" value={max_courses} />
        <LimitRow label="Students" value={max_students} />
        <LimitRow label="Active cohorts" value={max_cohorts_active} />
        <LimitRow label="Storage" value={`${max_storage_mb} MB`} />
        {max_teachers > 1 && <LimitRow label="Teachers" value={max_teachers} />}
        <LimitRow label="Platform cut" value={`${transaction_cut_percent}%`} />
      </div>

      {Object.keys(features).length > 0 && (
        <div className="space-y-1 border-t border-border pt-3 text-sm">
          {Object.entries(features).map(([key, enabled]) => (
            <div key={key} className="flex items-center gap-2">
              {enabled ? (
                <Check className="h-3.5 w-3.5 text-success shrink-0" />
              ) : (
                <X className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              )}
              <span className={enabled ? 'text-foreground' : 'text-muted-foreground/40'}>
                {key.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-[10px] font-medium text-muted-foreground/40 uppercase tracking-widest">
        PREVIEW — not published
      </p>
    </div>
  )
}

function LimitRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  )
}
