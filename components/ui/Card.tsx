/**
 * components/ui/Card.tsx — Content card container
 * Server-compatible (no 'use client' needed).
 */

type CardProps = {
  children: React.ReactNode
  className?: string
  hover?: boolean
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`
        rounded-lg border border-border bg-surface shadow-card
        ${hover ? 'hover:shadow-card-hover transition-shadow duration-200' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
