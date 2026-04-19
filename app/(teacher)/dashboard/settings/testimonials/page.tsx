/**
 * app/(teacher)/dashboard/settings/testimonials/page.tsx — Teacher testimonials management
 * Server Component.
 */

import type { Metadata } from 'next'
import { requireTeacher } from '@/lib/auth/guards'
import { getTestimonialsByTeacher } from '@/lib/db/testimonials'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { TestimonialForm } from './TestimonialForm'
import { TestimonialActions } from './TestimonialActions'

export const metadata: Metadata = {
  title: 'Testimonials \u2014 Skool Rooms',
}

export default async function TestimonialsPage() {
  const teacher = await requireTeacher()
  const testimonials = await getTestimonialsByTeacher(teacher.id)

  return (
    <>
      <PageHeader
        title="Testimonials"
        description="Add student testimonials to your public profile page."
        backHref={ROUTES.TEACHER.settings.root}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Add new testimonial */}
        <Card className="p-6">
          <h2 className="mb-4 text-base font-semibold text-foreground">Add Testimonial</h2>
          <TestimonialForm />
        </Card>

        {/* Existing testimonials */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            Your Testimonials ({testimonials.length})
          </h2>

          {testimonials.length === 0 ? (
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">
                No testimonials yet. Add your first one on the left.
              </p>
            </Card>
          ) : (
            testimonials.map((t, idx) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{t.author_name}</p>
                      {t.author_role && (
                        <p className="text-xs text-muted-foreground">{t.author_role}</p>
                      )}
                      {t.is_published ? (
                        <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">
                          Published
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Draft
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <TestimonialActions
                    testimonialId={t.id}
                    isPublished={t.is_published}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < testimonials.length - 1}
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
