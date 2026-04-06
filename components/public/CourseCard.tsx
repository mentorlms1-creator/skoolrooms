/**
 * components/public/CourseCard.tsx — Public course card
 * Server Component. Displays a course on the teacher's public page.
 */

import Image from 'next/image'
import { Card } from '@/components/ui/card'

type CourseCardProps = {
  title: string
  description: string | null
  thumbnailUrl: string | null
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
}: CourseCardProps) {
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
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {stripAndTruncate(description, 150)}
          </p>
        )}
      </div>
    </Card>
  )
}
