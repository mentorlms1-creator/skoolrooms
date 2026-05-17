'use client'

/**
 * components/teacher/LessonPlanGenerating.tsx
 * Shared loading indicator shown while the AI is generating or revising
 * a lesson plan. Long calls (10–30s) feel broken without explicit feedback,
 * so we combine a spinner, a rotating status phrase, and an indeterminate
 * progress bar.
 */

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

const PHRASES = [
  'Reading your inputs…',
  'Drafting learning objectives…',
  'Picking materials…',
  'Writing the warm-up…',
  'Building the main activity…',
  'Designing the assessment…',
  'Wrapping up homework…',
  'Polishing the plan…',
]

const REVISE_PHRASES = [
  'Re-reading the plan…',
  'Applying your changes…',
  'Re-balancing the timings…',
  'Re-checking objectives…',
  'Polishing the new version…',
]

function useRotatingPhrase(active: boolean, phrases: string[]): string {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!active) {
      setI(0)
      return
    }
    const id = setInterval(() => {
      setI((n) => (n + 1) % phrases.length)
    }, 2500)
    return () => clearInterval(id)
  }, [active, phrases])
  return phrases[i]
}

type Props = {
  /** 'full' = big block (use inside a dialog); 'inline' = chat-row sized. */
  variant?: 'full' | 'inline'
  mode?: 'generate' | 'revise'
}

export function LessonPlanGenerating({
  variant = 'full',
  mode = 'generate',
}: Props) {
  const phrase = useRotatingPhrase(true, mode === 'generate' ? PHRASES : REVISE_PHRASES)

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-3 rounded-md border border-border bg-muted/50 p-3">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {mode === 'generate' ? 'Generating…' : 'Revising plan…'}
          </p>
          <p className="truncate text-xs text-muted-foreground">{phrase}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <div className="text-center">
        <p className="text-base font-medium text-foreground">
          {mode === 'generate'
            ? 'Generating your lesson plan…'
            : 'Revising your lesson plan…'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{phrase}</p>
      </div>
      <div
        className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={mode === 'generate' ? 'Generating' : 'Revising'}
      >
        <div className="h-full w-1/3 animate-[lpbar_1.6s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
      <p className="text-xs text-muted-foreground">
        This usually takes 10–30 seconds.
      </p>
      <style jsx>{`
        @keyframes lpbar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  )
}
