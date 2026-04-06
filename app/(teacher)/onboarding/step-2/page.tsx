// =============================================================================
// app/(teacher)/onboarding/step-2/page.tsx — "Pick your subdomain" step
// Server Component — auth guard + passes teacher subdomain default to form.
// =============================================================================

import { requireTeacher } from '@/lib/auth/guards'
import { Card } from '@/components/ui/card'
import { platformDomain } from '@/lib/platform/domain'
import { Step2Form } from './form'

export default async function OnboardingStep2Page() {
  const teacher = await requireTeacher()

  return (
    <div>
      {/* Progress indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        <div className="h-2 w-16 rounded-full bg-primary" />
        <div className="h-2 w-16 rounded-full bg-primary" />
        <div className="h-2 w-16 rounded-full bg-border" />
      </div>

      <Card className="p-6">
        <h2 className="mb-1 text-xl font-semibold text-foreground">
          Pick your subdomain
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Choose a unique URL for your teaching page. Students will use this to
          find you.
        </p>

        <Step2Form
          defaultSubdomain={teacher.subdomain as string ?? ''}
          domain={platformDomain()}
        />
      </Card>
    </div>
  )
}
