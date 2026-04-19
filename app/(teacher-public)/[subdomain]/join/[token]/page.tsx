/**
 * app/(teacher-public)/[subdomain]/join/[token]/page.tsx
 * Server Component — Public enrollment page
 *
 * Fetches cohort+course by invite token. Shows one of four states:
 *   - Coming Soon (draft course or cohort)
 *   - Registration Closed (registration closed or display status = 'closed')
 *   - Cohort Full (display status = 'full')
 *   - Open (show enrollment card with course details and "Enroll Now" button)
 */

import { notFound } from 'next/navigation'
import Image from 'next/image'
import {
  getCohortByInviteToken,
  getActiveEnrollmentCount,
  computeCohortDisplayStatus,
} from '@/lib/db/cohorts'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { WaitlistForm } from '@/components/public/WaitlistForm'
import { EnrollNowButton } from '@/components/public/EnrollNowButton'
import { formatPKT } from '@/lib/time/pkt'
import { ROUTES } from '@/constants/routes'

type PageProps = {
  params: Promise<{ subdomain: string; token: string }>
}

/**
 * Formats a PKR amount with comma separators.
 * Example: 15000 -> "Rs. 15,000"
 */
function formatFeePKR(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK')}`
}

export default async function JoinCohortPage({ params }: PageProps) {
  const { token } = await params

  const cohort = await getCohortByInviteToken(token)
  if (!cohort) {
    notFound()
  }

  const course = cohort.courses
  const enrollmentCount = await getActiveEnrollmentCount(cohort.id)
  const displayStatus = computeCohortDisplayStatus(cohort, enrollmentCount)

  // --- Coming Soon: draft course or draft cohort ---
  if (course.status === 'draft' || cohort.status === 'draft') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card className="p-8 text-center">
          <div className="mb-4">
            <StatusBadge status="draft" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Coming Soon</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This course is being prepared. Check back later for enrollment details.
          </p>
        </Card>
      </div>
    )
  }

  // --- Registration Closed ---
  if (!cohort.is_registration_open || displayStatus === 'closed') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">Registration Closed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Registration for <span className="font-medium">{course.title}</span> is
            currently closed.
          </p>
          {cohort.waitlist_enabled && (
            <p className="mt-3 text-sm text-muted-foreground">
              A waitlist may be available when registration reopens.
            </p>
          )}
        </Card>
      </div>
    )
  }

  // --- Cohort Full ---
  if (displayStatus === 'full') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 space-y-6">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">Cohort Full</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            All spots in <span className="font-medium">{cohort.name}</span> are taken.
          </p>
          {!cohort.waitlist_enabled && (
            <p className="mt-3 text-sm text-muted-foreground">
              Check back later or contact the teacher for availability.
            </p>
          )}
        </Card>

        {cohort.waitlist_enabled && (
          <WaitlistForm
            cohortId={cohort.id}
            cohortName={cohort.name}
            courseName={course.title}
          />
        )}
      </div>
    )
  }

  // --- Open: Show enrollment card ---
  const spotsLeft =
    cohort.max_students !== null
      ? cohort.max_students - enrollmentCount
      : null
  const isFree = cohort.fee_pkr === 0
  const feeLabel = isFree ? '' : cohort.fee_type === 'monthly' ? '/month' : 'one-time'

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card className="overflow-hidden">
        {/* Course thumbnail */}
        {course.thumbnail_url && (
          <div className="relative aspect-video w-full overflow-hidden bg-background">
            <Image
              src={course.thumbnail_url}
              alt={course.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 512px"
            />
          </div>
        )}

        <div className="p-6">
          {/* Course title */}
          <h1 className="text-2xl font-bold text-foreground">{course.title}</h1>

          {/* Course description */}
          {course.description && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
              {(course.description as string).replace(/<[^>]*>/g, '')}
            </p>
          )}

          {/* Cohort details */}
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cohort</span>
              <span className="font-medium text-foreground">{cohort.name}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Starts</span>
              <span className="font-medium text-foreground">
                {formatPKT(cohort.start_date, 'date')}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Ends</span>
              <span className="font-medium text-foreground">
                {formatPKT(cohort.end_date, 'date')}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Fee</span>
              {isFree ? (
                <span className="font-medium text-foreground">Free</span>
              ) : (
                <span className="font-medium text-foreground">
                  {formatFeePKR(cohort.fee_pkr)}{' '}
                  <span className="text-xs text-muted-foreground">{feeLabel}</span>
                </span>
              )}
            </div>

            {spotsLeft !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Spots remaining</span>
                <span
                  className={`font-medium ${
                    spotsLeft <= 3 ? 'text-destructive' : 'text-foreground'
                  }`}
                >
                  {spotsLeft}
                </span>
              </div>
            )}
          </div>

          {/* Enroll button */}
          <div className="mt-6">
            <EnrollNowButton
              cohortId={cohort.id}
              inviteToken={token}
              isFree={isFree}
              loginHref={ROUTES.PLATFORM.studentLogin}
            />
            {isFree && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Free — no payment required.
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
