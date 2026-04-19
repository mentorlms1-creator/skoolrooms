'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, MinusCircle, Calendar } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AttendanceRing } from '@/components/ui/AttendanceRing'
import { formatPKT } from '@/lib/time/pkt'

export type ProgressTimelineEntry = {
  session_id: string
  scheduled_at: string
  cancelled: boolean
  present: boolean
}

export type ProgressSubmissionStats = {
  total_assignments: number
  submitted: number
  on_time: number
  late: number
  missing: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentName: string
  cohortName: string
  timeline: ProgressTimelineEntry[]
  stats: ProgressSubmissionStats
}

export function StudentProgressDialog({
  open,
  onOpenChange,
  studentName,
  cohortName,
  timeline,
  stats,
}: Props) {
  const now = Date.now()

  // Compute attendance summary excluding cancelled + future
  const counted = timeline.filter(
    (s) => !s.cancelled && new Date(s.scheduled_at).getTime() <= now,
  )
  const attended = counted.filter((s) => s.present).length
  const total = counted.length
  const percentage = total > 0 ? Math.round((attended / total) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{studentName} — Progress</DialogTitle>
          <p className="text-sm text-muted-foreground">{cohortName}</p>
        </DialogHeader>

        {timeline.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No classes have been scheduled yet.
          </p>
        ) : (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-4 flex items-center justify-center">
                <AttendanceRing
                  percentage={percentage}
                  attended={attended}
                  total={total}
                />
              </div>
              <div className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-4 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                  Submissions
                </p>
                <SubmissionStat label="Submitted" value={stats.submitted} total={stats.total_assignments} />
                <SubmissionStat label="On time" value={stats.on_time} />
                <SubmissionStat label="Late" value={stats.late} />
                <SubmissionStat label="Missing" value={stats.missing} tone="warn" />
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Timeline</h3>
              <ul className="divide-y divide-border rounded-2xl ring-1 ring-foreground/[0.03] overflow-hidden">
                {timeline.map((entry) => (
                  <TimelineRow key={entry.session_id} entry={entry} now={now} />
                ))}
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SubmissionStat({
  label,
  value,
  total,
  tone,
}: {
  label: string
  value: number
  total?: number
  tone?: 'warn'
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={tone === 'warn' && value > 0 ? 'font-bold text-destructive' : 'font-medium text-foreground'}>
        {value}
        {total !== undefined ? ` / ${total}` : ''}
      </span>
    </div>
  )
}

function TimelineRow({ entry, now }: { entry: ProgressTimelineEntry; now: number }) {
  const sessionTime = new Date(entry.scheduled_at).getTime()
  const isFuture = sessionTime > now

  let icon: React.ReactNode
  let label: string
  let toneClass: string

  if (entry.cancelled) {
    icon = <MinusCircle className="h-4 w-4 text-muted-foreground" />
    label = 'Cancelled'
    toneClass = 'bg-muted/30 text-muted-foreground'
  } else if (isFuture) {
    icon = <Calendar className="h-4 w-4 text-primary" />
    label = 'Upcoming'
    toneClass = 'bg-primary/10 text-primary'
  } else if (entry.present) {
    icon = <CheckCircle2 className="h-4 w-4 text-success" />
    label = 'Present'
    toneClass = 'bg-success/10 text-success'
  } else {
    icon = <XCircle className="h-4 w-4 text-destructive" />
    label = 'Absent'
    toneClass = 'bg-destructive/10 text-destructive'
  }

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {formatPKT(entry.scheduled_at, 'datetime')}
      </span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>{label}</span>
    </li>
  )
}

const _SubmissionStat = SubmissionStat
const _TimelineRow = TimelineRow
void _SubmissionStat
void _TimelineRow
