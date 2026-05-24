import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="h-[calc(100dvh-9rem)] md:h-[calc(100dvh-13rem)] min-h-[480px]">
      <div className="h-full bg-card rounded-3xl ring-1 ring-foreground/5 shadow-sm overflow-hidden">
        <div className="flex h-full">
          <aside className="hidden md:flex flex-col border-r border-foreground/[0.05] w-[320px] lg:w-[360px] shrink-0">
            <div className="px-5 py-4 border-b border-foreground/[0.05]">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-16 mt-2" />
            </div>
            <div className="p-3 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-2">
                  <Skeleton className="h-11 w-11 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          </aside>
          <section className="flex-1 hidden md:flex items-center justify-center">
            <Skeleton className="h-14 w-14 rounded-2xl" />
          </section>
        </div>
      </div>
    </div>
  )
}
