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
      <p className="text-sm text-muted">No students to show.</p>
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
                : 'text-danger'

          return (
            <div key={s.id} className="rounded-md border border-border p-3 sm:p-4 text-sm">
              <p className="font-medium text-ink">{s.name}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted">{s.attended} / {s.total} classes</span>
                <span className={`font-medium ${colorClass}`}>{s.percentage}%</span>
              </div>
            </div>
          )
        })}
      </div>
      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium text-muted">Student</th>
              <th className="px-3 py-2 text-right font-medium text-muted">Attended</th>
              <th className="px-3 py-2 text-right font-medium text-muted">Total</th>
              <th className="px-3 py-2 text-right font-medium text-muted">Rate</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const colorClass =
                s.percentage >= 80
                  ? 'text-success'
                  : s.percentage >= 50
                    ? 'text-warning'
                    : 'text-danger'

              return (
                <tr key={s.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-ink">{s.name}</td>
                  <td className="px-3 py-2 text-right text-ink">{s.attended}</td>
                  <td className="px-3 py-2 text-right text-muted">{s.total}</td>
                  <td className={`px-3 py-2 text-right font-medium ${colorClass}`}>
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
