/**
 * TestimonialsSection — Displays published teacher testimonials on the public profile page
 * Pure display component, no auth needed.
 */

import type { TestimonialRow } from '@/lib/db/testimonials'

type Props = {
  testimonials: TestimonialRow[]
}

export function TestimonialsSection({ testimonials }: Props) {
  if (testimonials.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-foreground">What students say</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {testimonials.map((t) => (
          <blockquote
            key={t.id}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <p className="text-sm leading-relaxed text-muted-foreground">
              &ldquo;{t.quote}&rdquo;
            </p>
            <footer className="mt-3">
              <p className="text-sm font-medium text-foreground">{t.author_name}</p>
              {t.author_role && (
                <p className="text-xs text-muted-foreground">{t.author_role}</p>
              )}
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  )
}
