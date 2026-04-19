/**
 * components/public/CourseCard.tsx — Public course card
 * Server Component. Displays a course on the teacher's public page.
 */

import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { categoryLabel } from '@/constants/course-categories'

type CurriculumItem = {
  id: string
  week_number: number
  title: string
  description: string | null
  display_order: number
}

type CourseCardProps = {
  title: string
  description: string | null
  thumbnailUrl: string | null
  category?: string | null
  tags?: string[]
  curriculum?: CurriculumItem[]
}

/**
 * Strip HTML tags and limit text to a given character count.
 */
function stripAndTruncate(html: string | null, maxLength: number): string {
  if (!html) return ''
  // Remove HTML tags
  const text = html.replace(/<[^>]*>/g, '')
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '...'
}

export function CourseCard({
  title,
  description,
  thumbnailUrl,
  category,
  tags,
  curriculum,
}: CourseCardProps) {
  const catLabel = categoryLabel(category)
  const safeTags = Array.isArray(tags) ? tags : []
  const items = Array.isArray(curriculum) ? curriculum : []

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      {thumbnailUrl && (
        <div className="relative h-40 w-full">
          <Image
            src={thumbnailUrl}
            alt={title}
            fill
            className="object-cover"
          />
          {catLabel && (
            <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-background/85 px-2 py-0.5 text-xs font-medium text-foreground shadow-sm backdrop-blur">
              {catLabel}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {!thumbnailUrl && catLabel && (
          <span className="mb-2 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            {catLabel}
          </span>
        )}

        <h3 className="text-lg font-semibold text-foreground">{title}</h3>

        {description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {stripAndTruncate(description, 150)}
          </p>
        )}

        {safeTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {safeTags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <details className="mt-3 group">
            <summary className="cursor-pointer text-sm font-medium text-foreground select-none">
              What you&apos;ll learn ({items.length} weeks)
            </summary>
            <ol className="mt-2 space-y-2 border-l-2 border-border pl-3">
              {items.map((item) => (
                <li key={item.id} className="text-sm">
                  <p className="font-medium text-foreground">
                    Week {item.week_number}: {item.title}
                  </p>
                  {item.description && (
                    <p className="mt-0.5 whitespace-pre-line text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </Card>
  )
}
