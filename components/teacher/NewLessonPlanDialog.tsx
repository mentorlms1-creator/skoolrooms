'use client'

/**
 * components/teacher/NewLessonPlanDialog.tsx
 * Client Component — Generates a new lesson plan via the streaming endpoint
 * /api/lesson-plans/generate. Renders the markdown live as tokens arrive,
 * then redirects to the plan detail page on `done`. Pre-stream errors
 * (quota exceeded, validation, feature flag) surface as toasts.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Loader2, StopCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ROUTES } from '@/constants/routes'
import {
  useStreamLessonPlan,
  type StreamErrorCode,
} from '@/hooks/useStreamLessonPlan'

const ERROR_MESSAGES: Record<StreamErrorCode, string> = {
  QUOTA_EXCEEDED:
    "You've used all your plans for this month. Upgrade to create more.",
  FEATURE_DISABLED: 'AI lesson planning is currently unavailable.',
  AI_TIMEOUT: 'The AI took too long to respond. Please try again.',
  AI_PROVIDER_ERROR:
    "Couldn't generate the plan right now. Please try again in a minute.",
  RATE_LIMITED: 'Slow down a bit — try again in a few seconds.',
  NOT_FOUND: 'Lesson plan not found.',
  COURSE_NOT_FOUND: 'Course not found.',
  VALIDATION_FAILED: 'Please check the form fields.',
  UNAUTHORIZED: 'Please sign in again.',
}

type Props = {
  courseId: string
  disabled?: boolean
  disabledReason?: string
}

export function NewLessonPlanDialog({ courseId, disabled, disabledReason }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear any pending post-done navigation if the component unmounts.
  useEffect(() => {
    return () => {
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current)
    }
  }, [])

  const [scope, setScope] = useState<'session' | 'unit'>('session')
  const [subject, setSubject] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [duration, setDuration] = useState('60')
  const [weeks, setWeeks] = useState('4')
  const [topic, setTopic] = useState('')
  const [goals, setGoals] = useState('')
  const [language, setLanguage] = useState<'english' | 'urdu' | 'roman-urdu'>(
    'english',
  )

  const stream = useStreamLessonPlan({
    onDone: ({ planId }) => {
      // Briefly let the user see the finished output before navigating away.
      // The timeout is tracked so unmount/close cancels it cleanly.
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current)
      navigateTimerRef.current = setTimeout(() => {
        navigateTimerRef.current = null
        setOpen(false)
        router.push(ROUTES.TEACHER.lessonPlanDetail(courseId, planId))
      }, 400)
    },
    onError: ({ code, message }) => {
      toast.error("Couldn't generate plan", {
        description: ERROR_MESSAGES[code] ?? message ?? code,
      })
    },
  })

  const canSubmit = !!subject && !!gradeLevel && !!topic && !!goals
  const isStreaming = stream.isStreaming

  function submit() {
    stream.start({
      url: '/api/lesson-plans/generate',
      body: {
        courseId,
        scope,
        subject,
        gradeLevel,
        durationMinutes: scope === 'session' ? Number(duration) : undefined,
        weekCount: scope === 'unit' ? Number(weeks) : undefined,
        topic,
        learningGoals: goals,
        language,
      },
    })
  }

  function handleOpenChange(next: boolean) {
    if (!next && isStreaming) {
      // Closing while streaming = cancel the stream.
      stream.stop()
    }
    if (!next) {
      // Closing dialog: cancel any pending post-done navigation so the
      // user isn't whisked off to the detail page after dismissing it.
      if (navigateTimerRef.current) {
        clearTimeout(navigateTimerRef.current)
        navigateTimerRef.current = null
      }
      stream.reset()
    }
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
        >
          New plan
        </Button>
      </DialogTrigger>
      <DialogContent
        className={isStreaming ? 'max-w-3xl' : 'max-w-lg'}
        onPointerDownOutside={(e) => isStreaming && e.preventDefault()}
        onEscapeKeyDown={(e) => isStreaming && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {isStreaming ? 'Writing your lesson plan…' : 'New lesson plan'}
          </DialogTitle>
          <DialogDescription>
            {isStreaming
              ? "Watch it appear below. We'll save it and open the editor when finished."
              : 'Tell the AI what to plan. It will generate a structured markdown outline you can revise afterwards.'}
          </DialogDescription>
        </DialogHeader>

        {isStreaming ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Streaming from the model…</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => stream.stop()}
                className="text-muted-foreground"
              >
                <StopCircle className="mr-1 h-4 w-4" />
                Stop
              </Button>
            </div>
            <article
              className="
                max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-card p-5
                text-sm leading-relaxed text-foreground
                [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-lg [&_h1]:font-semibold
                [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold
                [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold
                [&_p]:mb-2
                [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5
                [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5
                [&_li]:mb-1
                [&_strong]:font-semibold
                [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs
              "
            >
              {stream.markdown ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {stream.markdown}
                </ReactMarkdown>
              ) : (
                <p className="text-muted-foreground">Waiting for the first token…</p>
              )}
            </article>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Scope</Label>
              <RadioGroup
                value={scope}
                onValueChange={(v) => setScope(v as 'session' | 'unit')}
                className="mt-2 flex gap-4"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="session" /> Single session
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="unit" /> Full unit
                </label>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="grade">Grade level</Label>
              <Input
                id="grade"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                maxLength={50}
                placeholder="e.g. Class 8, O-Level, Grade 5"
              />
            </div>
            {scope === 'session' ? (
              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={15}
                  max={240}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="weeks">Number of weeks</Label>
                <Input
                  id="weeks"
                  type="number"
                  min={1}
                  max={24}
                  value={weeks}
                  onChange={(e) => setWeeks(e.target.value)}
                />
              </div>
            )}
            <div>
              <Label htmlFor="topic">Topic</Label>
              <Input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={200}
              />
            </div>
            <div>
              <Label htmlFor="goals">Learning goals</Label>
              <Textarea
                id="goals"
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                maxLength={2000}
                rows={3}
              />
            </div>
            <div>
              <Label>Language</Label>
              <Select
                value={language}
                onValueChange={(v) =>
                  setLanguage(v as 'english' | 'urdu' | 'roman-urdu')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="urdu">Urdu</SelectItem>
                  <SelectItem value="roman-urdu">Roman Urdu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={!canSubmit}>
                Generate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
