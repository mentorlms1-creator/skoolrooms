/**
 * app/(teacher)/dashboard/settings/page.tsx — Teacher profile settings
 *
 * Server Component. Displays editable profile form.
 */

import type { Metadata } from 'next'
import { Link } from 'next-view-transitions'
import { ChevronRight, Gift, Quote, Receipt } from 'lucide-react'
import { requireTeacher } from '@/lib/auth/guards'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProfileSettingsForm } from '@/components/teacher/ProfileSettingsForm'
import { ChangeSubdomainSection } from '@/components/teacher/ChangeSubdomainSection'
import { Card } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Settings \u2014 Skool Rooms',
}

export default async function TeacherSettingsPage() {
  const teacher = await requireTeacher()

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your profile and account settings."
      />

      <ProfileSettingsForm
        initialData={{
          name: teacher.name,
          bio: teacher.bio ?? '',
          city: teacher.city ?? '',
          profilePhotoUrl: teacher.profile_photo_url ?? '',
          isPubliclyListed: teacher.is_publicly_listed,
          subjectTags: (teacher.subject_tags ?? []).join(', '),
          teachingLevels: (teacher.teaching_levels ?? []).join(', '),
        }}
      />

      <div className="mt-6">
        <ChangeSubdomainSection
          currentSubdomain={teacher.subdomain as string}
          subdomainChangedAt={(teacher.subdomain_changed_at as string) ?? null}
        />
      </div>

      {/* Referrals + Testimonials links */}
      <div className="mt-6 space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          More Settings
        </h2>
        <Card>
          <Link
            href="/dashboard/settings/referrals"
            className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors rounded-t-xl"
          >
            <div className="flex items-center gap-3">
              <Gift className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Referrals</p>
                <p className="text-xs text-muted-foreground">
                  Invite teachers and earn 30 bonus days
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>

          <Link
            href="/dashboard/settings/testimonials"
            className="flex items-center justify-between border-t border-border px-5 py-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Quote className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Testimonials</p>
                <p className="text-xs text-muted-foreground">
                  Add student testimonials to your public page
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>

          <Link
            href="/dashboard/settings/billing"
            className="flex items-center justify-between border-t border-border px-5 py-4 hover:bg-muted/30 transition-colors rounded-b-xl"
          >
            <div className="flex items-center gap-3">
              <Receipt className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Billing</p>
                <p className="text-xs text-muted-foreground">
                  Subscription history, payouts and invoices
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </Card>
      </div>
    </>
  )
}
