/**
 * components/public/StarRating.tsx — Read-only star rating display.
 * Server-compatible (no 'use client'). Renders 5 stars with ½-step precision
 * via lucide Star/StarHalf. Hidden when count === 0.
 */

import { Star, StarHalf } from 'lucide-react'

type StarRatingProps = {
  value: number      // 0..5, may have one decimal
  count: number      // total reviews
  size?: 'sm' | 'md' // default 'sm'
}

export function StarRating({ value, count, size = 'sm' }: StarRatingProps) {
  if (count === 0) return null

  const iconSize = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'
  const textSize = size === 'md' ? 'text-sm' : 'text-xs'

  const stars = []
  for (let i = 1; i <= 5; i++) {
    if (value >= i) {
      stars.push(
        <Star
          key={i}
          className={`${iconSize} fill-primary text-primary`}
          aria-hidden="true"
        />
      )
    } else if (value >= i - 0.5) {
      stars.push(
        <StarHalf
          key={i}
          className={`${iconSize} fill-primary text-primary`}
          aria-hidden="true"
        />
      )
    } else {
      stars.push(
        <Star
          key={i}
          className={`${iconSize} text-muted-foreground/40`}
          aria-hidden="true"
        />
      )
    }
  }

  return (
    <div
      className={`flex items-center gap-1 ${textSize}`}
      aria-label={`Rated ${value.toFixed(1)} out of 5 from ${count} ${count === 1 ? 'review' : 'reviews'}`}
    >
      <div className="flex items-center gap-0.5">{stars}</div>
      <span className="font-medium text-foreground">{value.toFixed(1)}</span>
      <span className="text-muted-foreground">
        ({count} {count === 1 ? 'review' : 'reviews'})
      </span>
    </div>
  )
}
