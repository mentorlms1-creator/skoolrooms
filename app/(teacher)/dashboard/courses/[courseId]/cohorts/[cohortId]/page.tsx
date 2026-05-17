/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/page.tsx — Cohort detail
 *
 * Server Component. Hero-style overview of a single cohort: identity,
 * metadata strip, KPI cards (gated by plan for revenue), management tiles,
 * and an invite share row.
 */

import type { Metadata } from 'next'
import { Link } from 'next-view-transitions'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Users,
  ListChecks,
  TrendingUp,
  Wallet,
  CheckCircle2,
  Heart,
  Lock,
  CalendarRange,
  UserSquare2,
  Megaphone,
  ClipboardCheck,
  BookMarked,
  ArrowRight,
} from 'lucide-react'
import { requireTeacher } from '@/lib/auth/guards'
import {
  getCohortById,
  getActiveEnrollmentCount,
  computeCohortDisplayStatus,
  getCohortAnalytics,
  type CohortAnalytics,
} from '@/lib/db/cohorts'
import { getCourseById } from '@/lib/db/courses'
import { getActiveEnrollmentsByCohort } from '@/lib/db/enrollments'
import { canUseFeature } from '@/lib/plans/features'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/button'
import { DuplicateCohortButton } from '@/components/teacher/DuplicateCohortButton'
import { CohortInviteRow } from '@/components/teacher/CohortInviteRow'
import { ROUTES } from '@/constants/routes'
import { formatPKT } from '@/lib/time/pkt'
import { cn } from '@/lib/utils'

type CohortDetailPageProps = {
  params: Promise<{ courseId: string; cohortId: string }>
}

export async function generateMetadata({ params }: CohortDetailPageProps): Promise<Metadata> {
  const { cohortId } = await params
  const cohort = await getCohortById(cohortId)
  if (!cohort) return { title: 'Cohort — Skool Rooms' }
  return { title: `${cohort.name} — Skool Rooms` }
}

export default async function CohortDetailPage({ params }: CohortDetailPageProps) {
  const { courseId, cohortId } = await params
  const teacher = await requireTeacher()

  const [cohort, course] = await Promise.all([
    getCohortById(cohortId),
    getCourseById(courseId),
  ])

  if (!cohort || cohort.teacher_id !== teacher.id) notFound()
  if (!course || course.teacher_id !== teacher.id) notFound()

  const enrollmentCount = await getActiveEnrollmentCount(cohortId)
  const displayStatus = computeCohortDisplayStatus(cohort, enrollmentCount)

  const archivedActiveCount =
    cohort.status === 'archived'
      ? (await getActiveEnrollmentsByCohort(cohortId)).length
      : 0

  const canSeeRevenueAnalytics = await canUseFeature(teacher.id, 'revenue_analytics')
  const analytics = canSeeRevenueAnalytics
    ? await getCohortAnalytics(cohortId, teacher.id)
    : null

  const isArchived = cohort.status === 'archived'

  const feeLabel =
    cohort.fee_type === 'monthly'
      ? `Rs. ${cohort.fee_pkr.toLocaleString()}/mo · day ${cohort.billing_day}`
      : `Rs. ${cohort.fee_pkr.toLocaleString()} · one-time`

  const enrollmentLabel =
    cohort.max_students !== null
      ? `${enrollmentCount} / ${cohort.max_students} students`
      : `${enrollmentCount} student${enrollmentCount === 1 ? '' : 's'}`

  const enrollmentChip =
    cohort.max_students !== null
      ? `${enrollmentCount} of ${cohort.max_students} students enrolled`
      : `${enrollmentCount} student${enrollmentCount === 1 ? '' : 's'} enrolled`

  const registrationLabel = cohort.is_registration_open ? 'Registration open' : 'Registration closed'

  return (
    <>
      {/* Top bar: back + actions */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href={ROUTES.TEACHER.courseDetail(courseId)}
          aria-label="Back to course"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card text-muted-foreground ring-1 ring-foreground/5 shadow-sm transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="flex items-center gap-2">
          <DuplicateCohortButton cohortId={cohortId} courseId={courseId} />
          {!isArchived && (
            <Link href={ROUTES.TEACHER.cohortEdit(courseId, cohortId)}>
              <Button variant="secondary">Edit</Button>
            </Link>
          )}
          <Link href={ROUTES.TEACHER.cohortSchedule(courseId, cohortId)}>
            <Button variant="primary" className="gap-1.5">
              Open classroom
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(260px,360px)]">
        <div className="flex flex-col justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-[2.75rem] leading-[1.05]">
              {cohort.name}
            </h1>
            <p className="mt-2 text-lg font-medium text-primary/90">{course.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                cohort.is_registration_open
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-border bg-secondary text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  cohort.is_registration_open ? 'bg-success' : 'bg-muted-foreground/50'
                )}
                aria-hidden="true"
              />
              {registrationLabel}
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-foreground/80">
              {enrollmentChip}
            </span>
            <StatusBadge status={displayStatus} size="sm" />
          </div>
        </div>

        {/* Decorative panel — pure CSS, no asset dependency */}
        <div
          aria-hidden="true"
          className="relative hidden h-44 overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-primary/15 via-primary/5 to-accent/10 lg:block"
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute -bottom-8 left-4 h-32 w-32 rounded-full bg-accent/30 blur-3xl" />
          <div className="absolute right-6 top-6 h-10 w-10 rounded-2xl bg-card/70 shadow-sm ring-1 ring-foreground/5 backdrop-blur" />
          <div className="absolute bottom-6 right-10 h-16 w-12 rounded-xl bg-card/80 shadow-sm ring-1 ring-foreground/5 backdrop-blur" />
        </div>
      </section>

      {/* Archived nudge — preserved */}
      {archivedActiveCount > 0 && (
        <div className="mb-6 rounded-2xl border border-warning/40 bg-warning/5 px-5 py-4 text-sm text-foreground">
          <p>
            You have {archivedActiveCount} active{' '}
            {archivedActiveCount === 1 ? 'student' : 'students'} in this archived cohort. Mark them complete to issue certificates.
          </p>
          <Link
            href={ROUTES.TEACHER.cohortStudents(courseId, cohortId)}
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            Go to students &rarr;
          </Link>
        </div>
      )}

      {/* Info strip */}
      <div className="mb-10 grid grid-cols-1 gap-3 rounded-3xl border border-border/40 bg-card p-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border/40 lg:p-2">
        <InfoTile
          icon={<BookOpen className="h-5 w-5" />}
          label="Course"
          value={course.title}
        />
        <InfoTile
          icon={<CalendarDays className="h-5 w-5" />}
          label="Date range"
          value={`${formatPKT(cohort.start_date, 'date')} – ${formatPKT(cohort.end_date, 'date')}`}
        />
        <InfoTile
          icon={<Users className="h-5 w-5" />}
          label="Enrollment"
          value={enrollmentLabel}
        />
        <InfoTile
          icon={<ListChecks className="h-5 w-5" />}
          label="Fee"
          value={feeLabel}
        />
      </div>

      {/* Overview */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Overview</h2>
        <OverviewGrid
          enrollmentCount={enrollmentCount}
          maxStudents={cohort.max_students}
          analytics={analytics}
          analyticsLocked={!canSeeRevenueAnalytics}
          displayStatus={displayStatus}
          isArchived={isArchived}
          waitlistEnabled={cohort.waitlist_enabled}
        />
      </section>

      {/* Manage your classroom */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Manage your classroom</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <ManageTile
            href={ROUTES.TEACHER.cohortSchedule(courseId, cohortId)}
            icon={<CalendarRange className="h-5 w-5" />}
            title="Schedule"
            description="View and manage class sessions"
            tone="violet"
          />
          <ManageTile
            href={ROUTES.TEACHER.cohortStudents(courseId, cohortId)}
            icon={<UserSquare2 className="h-5 w-5" />}
            title="Students"
            description="See students and their progress"
            tone="sky"
          />
          <ManageTile
            href={ROUTES.TEACHER.cohortAnnouncements(courseId, cohortId)}
            icon={<Megaphone className="h-5 w-5" />}
            title="Announcements"
            description="Send updates and share information"
            tone="amber"
          />
          <ManageTile
            href={ROUTES.TEACHER.cohortAttendance(courseId, cohortId)}
            icon={<ClipboardCheck className="h-5 w-5" />}
            title="Attendance"
            description="Track attendance and engagement"
            tone="emerald"
          />
          <ManageTile
            href={ROUTES.TEACHER.courseCurriculum(courseId)}
            icon={<BookMarked className="h-5 w-5" />}
            title="Curriculum"
            description="Manage syllabus and materials"
            tone="rose"
          />
        </div>
      </section>

      {/* Invite row — hidden when archived (matches old behavior) */}
      {!isArchived && <CohortInviteRow inviteToken={cohort.invite_token} />}
    </>
  )
}

// -----------------------------------------------------------------------------
// Sub-components (kept colocated — used only by this page)
// -----------------------------------------------------------------------------

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  )
}

type StatCardProps = {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ReactNode
  iconTone?: 'violet' | 'sky' | 'amber' | 'emerald' | 'rose' | 'muted'
  children?: React.ReactNode
  locked?: boolean
}

const TONE_BG: Record<NonNullable<StatCardProps['iconTone']>, string> = {
  violet: 'bg-primary/10 text-primary',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  muted: 'bg-secondary text-muted-foreground',
}

function StatCard({
  label,
  value,
  hint,
  icon,
  iconTone = 'muted',
  children,
  locked,
}: StatCardProps) {
  return (
    <div className="relative flex flex-col gap-3 rounded-3xl border border-border/40 bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon && (
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', TONE_BG[iconTone])}>
            {locked ? <Lock className="h-4 w-4" aria-hidden="true" /> : icon}
          </div>
        )}
      </div>
      <div className="text-3xl font-bold text-foreground leading-none">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      {children}
    </div>
  )
}

function OverviewGrid({
  enrollmentCount,
  maxStudents,
  analytics,
  analyticsLocked,
  displayStatus,
  isArchived,
  waitlistEnabled,
}: {
  enrollmentCount: number
  maxStudents: number | null
  analytics: CohortAnalytics | null
  analyticsLocked: boolean
  displayStatus: string
  isArchived: boolean
  waitlistEnabled: boolean
}) {
  const progressPct =
    maxStudents && maxStudents > 0
      ? Math.min(100, Math.round((enrollmentCount / maxStudents) * 100))
      : null

  // Cohort health derives from displayStatus — cheap, no extra query
  const health = (() => {
    if (isArchived) return { label: 'Archived', tone: 'muted' as const, note: 'Cohort is read-only' }
    switch (displayStatus) {
      case 'active':
      case 'enrolled':
      case 'published':
        return { label: 'Excellent', tone: 'success' as const, note: 'Everything looks good' }
      case 'upcoming':
      case 'pending':
        return { label: 'Upcoming', tone: 'warning' as const, note: 'Not started yet' }
      case 'completed':
        return { label: 'Completed', tone: 'success' as const, note: 'All sessions delivered' }
      default:
        return { label: 'Draft', tone: 'muted' as const, note: 'Not published yet' }
    }
  })()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Enrollment progress */}
      <StatCard
        label="Enrollment progress"
        icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
        iconTone="violet"
        value={progressPct !== null ? `${progressPct}%` : `${enrollmentCount}`}
        hint={
          maxStudents !== null
            ? `${enrollmentCount} of ${maxStudents} students`
            : 'Unlimited capacity'
        }
      >
        {progressPct !== null && (
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </StatCard>

      {/* Payments collected */}
      <StatCard
        label="Payments collected"
        icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
        iconTone="emerald"
        locked={analyticsLocked}
        value={
          analyticsLocked ? (
            <span className="text-base font-semibold text-muted-foreground">Upgrade to view</span>
          ) : analytics ? (
            `Rs. ${analytics.revenue_collected_pkr.toLocaleString()}`
          ) : (
            'Rs. 0'
          )
        }
        hint={
          analyticsLocked
            ? 'Available on paid plans'
            : analytics
            ? analytics.revenue_pending_pkr > 0
              ? `Rs. ${analytics.revenue_pending_pkr.toLocaleString()} pending`
              : 'No pending payments'
            : 'No payments yet'
        }
      />

      {/* Projected revenue */}
      <StatCard
        label="Projected revenue"
        icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
        iconTone="sky"
        locked={analyticsLocked}
        value={
          analyticsLocked ? (
            <span className="text-base font-semibold text-muted-foreground">Upgrade to view</span>
          ) : analytics ? (
            `Rs. ${analytics.projected_revenue_pkr.toLocaleString()}`
          ) : (
            'Rs. 0'
          )
        }
        hint={
          analyticsLocked
            ? 'Available on paid plans'
            : analytics?.projection_horizon_label ?? 'Based on current enrollment'
        }
      />

      {/* Cohort health */}
      <StatCard
        label="Cohort health"
        icon={<Heart className="h-4 w-4" aria-hidden="true" />}
        iconTone={health.tone === 'success' ? 'emerald' : health.tone === 'warning' ? 'amber' : 'muted'}
        value={
          <span
            className={cn(
              'text-2xl font-bold',
              health.tone === 'success' && 'text-success',
              health.tone === 'warning' && 'text-warning',
              health.tone === 'muted' && 'text-muted-foreground'
            )}
          >
            {health.label}
          </span>
        }
        hint={
          <span className="inline-flex items-center gap-1.5">
            {health.tone === 'success' && (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
            )}
            {health.note}
            {waitlistEnabled && ' · Waitlist on'}
          </span>
        }
      />
    </div>
  )
}

type ManageTone = 'violet' | 'sky' | 'amber' | 'emerald' | 'rose'

const MANAGE_TONE: Record<ManageTone, string> = {
  violet: 'bg-primary/10 text-primary',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}

function ManageTile({
  href,
  icon,
  title,
  description,
  tone,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
  tone: ManageTone
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-6 rounded-3xl border border-border/40 bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-sm"
    >
      <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', MANAGE_TONE[tone])}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <ArrowRight
        className="absolute bottom-5 right-5 h-4 w-4 text-muted-foreground/60 transition-all group-hover:translate-x-0.5 group-hover:text-foreground"
        aria-hidden="true"
      />
    </Link>
  )
}
