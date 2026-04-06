import { Spinner } from '@/components/ui/Spinner'

export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Spinner size="lg" />
    </div>
  )
}
