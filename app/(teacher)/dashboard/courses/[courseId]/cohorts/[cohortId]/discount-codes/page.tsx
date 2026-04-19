/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/discount-codes/page.tsx
 * Server Component — Teacher discount code management for a cohort
 */

import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getCohortById } from '@/lib/db/cohorts'
import { getCourseById } from '@/lib/db/courses'
import { getDiscountCodesByCohort } from '@/lib/db/discount-codes'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { DiscountCodeForm } from './DiscountCodeForm'

type PageProps = {
  params: Promise<{ courseId: string; cohortId: string }>
}

export default async function DiscountCodesPage({ params }: PageProps) {
  const { courseId, cohortId } = await params
  const teacher = await requireTeacher()

  const [cohort, course] = await Promise.all([
    getCohortById(cohortId),
    getCourseById(courseId),
  ])

  if (!cohort || cohort.teacher_id !== teacher.id) notFound()
  if (!course || course.teacher_id !== teacher.id) notFound()

  const codes = await getDiscountCodesByCohort(cohortId)

  return (
    <>
      <PageHeader
        title="Discount Codes"
        description={`Manage discount codes for ${cohort.name}`}
        backHref={ROUTES.TEACHER.cohortEdit(courseId, cohortId)}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Add new code form */}
        <Card className="p-6">
          <h2 className="mb-4 text-base font-semibold text-foreground">Add Discount Code</h2>
          <DiscountCodeForm cohortId={cohortId} feePkr={cohort.fee_pkr} />
        </Card>

        {/* Existing codes list */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            Active Codes ({codes.length})
          </h2>

          {codes.length === 0 ? (
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">
                No discount codes yet. Create one on the left.
              </p>
            </Card>
          ) : (
            codes.map((code) => (
              <Card key={code.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-base font-bold text-foreground">
                      {code.code}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {code.discount_type === 'percent'
                        ? `${code.discount_value}% off`
                        : `Rs. ${code.discount_value.toLocaleString()} off`}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Used: {code.use_count}{code.max_uses ? ` / ${code.max_uses}` : ''}</span>
                      {code.expires_at && (
                        <span>
                          Expires: {new Date(code.expires_at).toLocaleDateString('en-PK')}
                        </span>
                      )}
                    </div>
                  </div>
                  <DiscountCodeForm
                    cohortId={cohortId}
                    feePkr={cohort.fee_pkr}
                    existing={code}
                    mode="delete"
                  />
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  )
}
