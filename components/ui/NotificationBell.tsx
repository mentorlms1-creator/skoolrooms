import { Bell } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type NotificationBellProps = {
  count: number
  href: string
  className?: string
}

export function NotificationBell({ count, href, className }: NotificationBellProps) {
  return (
    <Link href={href} className={cn("relative inline-flex items-center justify-center", className)}>
      <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
