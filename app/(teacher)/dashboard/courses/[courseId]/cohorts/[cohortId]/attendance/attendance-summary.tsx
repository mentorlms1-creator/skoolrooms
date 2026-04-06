/**
 * AttendanceSummaryTable — Server-compatible component
 * Displays per-student attendance summary: attended / total and percentage.
 */

type StudentSummary = {
  id: string
  name: string
  attended: number
  total: number
  percentage: number
}

type AttendanceSummaryTableProps = {
  summaries: StudentSummary[]
}

export function AttendanceSummaryTable({ summaries }: AttendanceSummaryTableProps) {
  if (summaries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No students to show.</p>
    )
  }

  // Sort by attendance percentage ascending (lowest first for teacher attention)
  const sorted = [...summaries].sort((a, b) => a.percentage - b.percentage)

  return (
    <>
      {/* Mobile card view */}
      <div className="md:hidden flex flex-col gap-3">
        {sorted.map((s) => {
          const colorClass =
            s.percentage >= 80
              ? 'text-success'
              : s.percentage >= 50
                ? 'text-warning'
                : 'text-destructive'

          return (
            <div key={s.id} className="rounded-2xl ring-1 ring-foreground/[0.03] bg-card p-4 text-sm">
              <p className="font-medium text-foreground">{s.name}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted-foreground">{s.attended} / {s.total} classes</span>
                <span className={`font-medium ${colorClass}`}>{s.percentage}%</span>
              </div>
            </div>
          )
        })}
      </div>
      {/* Desktop table view */}
      <div className="hidden md:block rounded-[2rem] ring-1 ring-foreground/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-container">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Student</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Attended</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Total</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Rate</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const colorClass =
                s.percentage >= 80
                  ? 'text-success'
                  : s.percentage >= 50
                    ? 'text-warning'
                    : 'text-destructive'

              return (
                <tr key={s.id} className="border-b border-foreground/[0.03] last:border-b-0">
                  <td className="px-4 py-3 text-foreground">{s.name}</td>
                  <td className="px-4 py-3 text-right text-foreground">{s.attended}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{s.total}</td>
                  <td className={`px-4 py-3 text-right font-medium ${colorClass}`}>
                    {s.percentage}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
