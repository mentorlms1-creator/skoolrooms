'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { duplicateCohortAction } from '@/lib/actions/cohorts'
import { ROUTES } from '@/constants/routes'

type Props = {
  cohortId: string
  courseId: string
}

export function DuplicateCohortButton({ cohortId, courseId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDuplicate() {
    setLoading(true)
    setError(null)

    const result = await duplicateCohortAction(cohortId)

    if (!result.success) {
      setError(result.error ?? 'Failed to duplicate cohort.')
      setLoading(false)
      return
    }

    if (!result.data) {
      setError('Failed to duplicate cohort.')
      setLoading(false)
      return
    }

    router.push(`${ROUTES.TEACHER.cohortEdit(courseId, result.data.cohortId)}?from=duplicate`)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        onClick={handleDuplicate}
        disabled={loading}
      >
        <Copy className="mr-2 h-4 w-4" />
        {loading ? 'Duplicating…' : 'Duplicate Cohort'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
