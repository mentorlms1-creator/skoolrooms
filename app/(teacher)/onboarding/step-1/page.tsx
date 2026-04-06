// =============================================================================
// app/(teacher)/onboarding/step-1/page.tsx — "What do you teach?" step
// Server Component — auth guard + passes teacher defaults to client form.
// =============================================================================

import { requireTeacher } from '@/lib/auth/guards'
import { Card } from '@/components/ui/card'
import { Step1Form } from './form'

export default async function OnboardingStep1Page() {
  const teacher = await requireTeacher()

  return (
    <div>
      {/* Progress indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        <div className="h-2 w-16 rounded-full bg-primary" />
        <div className="h-2 w-16 rounded-full bg-border" />
        <div className="h-2 w-16 rounded-full bg-border" />
      </div>

      <Card className="p-6">
        <h2 className="mb-1 text-xl font-semibold text-foreground">
          What do you teach?
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Select the subjects and levels you teach. This helps students find you.
        </p>

        <Step1Form
          defaultSubjects={teacher.subject_tags as string[] ?? []}
          defaultLevels={teacher.teaching_levels as string[] ?? []}
        />
      </Card>
    </div>
  )
}
