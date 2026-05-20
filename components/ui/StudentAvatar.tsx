// components/ui/StudentAvatar.tsx
//
// Shared avatar primitive. Renders the student's uploaded photo if present,
// otherwise a deterministic OKLCH-tinted circle with initials. Used wherever
// a student is identified visually (table rows, mobile cards, settings
// preview, future detail pages).
//
// Server-compatible (no client hooks).

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { avatarColorVar, avatarInitials } from '@/lib/utils/avatar'

type StudentAvatarSize = 'sm' | 'md' | 'lg'

type StudentAvatarProps = {
  id: string
  name: string
  photoUrl?: string | null
  size?: StudentAvatarSize
  className?: string
}

const sizeMap: Record<StudentAvatarSize, { px: number; text: string }> = {
  sm: { px: 24, text: 'text-[9px]' },
  md: { px: 32, text: 'text-[11px]' },
  lg: { px: 56, text: 'text-lg' },
}

export function StudentAvatar({
  id,
  name,
  photoUrl,
  size = 'md',
  className,
}: StudentAvatarProps) {
  const { px, text } = sizeMap[size]
  const dim = `${px}px`

  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={name}
        width={px}
        height={px}
        className={cn(
          'rounded-full object-cover shrink-0',
          className,
        )}
        style={{ width: dim, height: dim }}
      />
    )
  }

  return (
    <div
      aria-label={name}
      className={cn(
        'inline-flex items-center justify-center rounded-full shrink-0 font-semibold text-avatar-foreground select-none',
        text,
        className,
      )}
      style={{
        width: dim,
        height: dim,
        background: avatarColorVar(id),
      }}
    >
      {avatarInitials(name)}
    </div>
  )
}
