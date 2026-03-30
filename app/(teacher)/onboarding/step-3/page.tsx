// =============================================================================
// app/(teacher)/onboarding/step-3/page.tsx — "Complete your profile" step
// Server Component — auth guard + passes teacher data to client form.
// =============================================================================

import { requireTeacher } from '@/lib/auth/guards'
import { Card } from '@/components/ui/Card'
import { Step3Form } from './form'

export default async function OnboardingStep3Page() {
  const teacher = await requireTeacher()

  return (
    <div>
      {/* Progress indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        <div className="h-2 w-16 rounded-full bg-brand-600" />
        <div className="h-2 w-16 rounded-full bg-brand-600" />
        <div className="h-2 w-16 rounded-full bg-brand-600" />
      </div>

      <Card className="p-6">
        <h2 className="mb-1 text-xl font-semibold text-ink">
          Complete your profile
        </h2>
        <p className="mb-6 text-sm text-muted">
          Add a photo and bio so students know who you are.
        </p>

        <Step3Form
          teacherId={teacher.id as string}
          defaultBio={(teacher.bio as string) ?? ''}
          defaultPhotoUrl={(teacher.profile_photo_url as string) ?? ''}
        />
      </Card>
    </div>
  )
}
