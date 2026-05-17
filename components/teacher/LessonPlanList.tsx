'use client'

/**
 * components/teacher/LessonPlanList.tsx
 * Client Component — Renders the teacher's lesson plans for a course with
 * Open / Download PDF / Delete actions. Uses sonner for toasts.
 */

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { formatPKT } from '@/lib/time/pkt'
import { ROUTES } from '@/constants/routes'
import { deleteLessonPlanAction } from '@/lib/actions/lessonPlans'

export type LessonPlanListItem = {
  id: string
  title: string
  scope: 'session' | 'unit'
  updated_at: string
}

type Props = {
  courseId: string
  plans: LessonPlanListItem[]
}

export function LessonPlanList({ courseId, plans }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function onDelete(planId: string) {
    if (!confirm('Delete this lesson plan? This cannot be undone.')) return
    start(async () => {
      const res = await deleteLessonPlanAction({ planId, courseId })
      if (res.success) {
        router.refresh()
      } else {
        toast.error("Couldn't delete", { description: res.error })
      }
    })
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <p className="text-lg font-medium text-foreground">No lesson plans yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Generate your first lesson plan with AI.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-2">Title</th>
            <th className="px-4 py-2">Scope</th>
            <th className="px-4 py-2">Updated</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id} className="border-t border-border">
              <td className="px-4 py-2">
                <Link
                  href={ROUTES.TEACHER.lessonPlanDetail(courseId, p.id)}
                  className="font-medium text-primary hover:underline"
                >
                  {p.title}
                </Link>
              </td>
              <td className="px-4 py-2 capitalize">{p.scope}</td>
              <td className="px-4 py-2 text-muted-foreground">
                {formatPKT(p.updated_at, 'datetime')}
              </td>
              <td className="px-4 py-2 text-right">
                <a
                  href={`/api/lesson-plans/${p.id}/pdf`}
                  className="mr-2 text-sm text-primary hover:underline"
                >
                  PDF
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => onDelete(p.id)}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
