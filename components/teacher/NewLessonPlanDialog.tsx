'use client'

/**
 * components/teacher/NewLessonPlanDialog.tsx
 * Client Component — Form dialog to generate a new lesson plan via AI.
 * Calls createLessonPlan Server Action; on success redirects to the plan
 * detail page. Surfaces typed error codes via sonner toast.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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
  createLessonPlan,
  type LessonPlanErrorCode,
} from '@/lib/actions/lessonPlans'
import { LessonPlanGenerating } from './LessonPlanGenerating'

const ERROR_MESSAGES: Record<LessonPlanErrorCode, string> = {
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
  const [pending, start] = useTransition()

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

  const canSubmit = !!subject && !!gradeLevel && !!topic && !!goals

  function submit() {
    start(async () => {
      const res = await createLessonPlan({
        courseId,
        scope,
        subject,
        gradeLevel,
        durationMinutes: scope === 'session' ? Number(duration) : undefined,
        weekCount: scope === 'unit' ? Number(weeks) : undefined,
        topic,
        learningGoals: goals,
        language,
      })
      if (res.success) {
        setOpen(false)
        router.push(ROUTES.TEACHER.lessonPlanDetail(courseId, res.data.planId))
      } else {
        const code = (res.code as LessonPlanErrorCode) ?? 'AI_PROVIDER_ERROR'
        toast.error("Couldn't generate plan", {
          description: ERROR_MESSAGES[code] ?? res.error,
        })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
        >
          New plan
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-lg"
        onPointerDownOutside={(e) => pending && e.preventDefault()}
        onEscapeKeyDown={(e) => pending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>New lesson plan</DialogTitle>
          <DialogDescription>
            Tell the AI what to plan. It will generate a structured markdown
            outline you can revise afterwards.
          </DialogDescription>
        </DialogHeader>
        {pending ? (
          <LessonPlanGenerating variant="full" mode="generate" />
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
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || !canSubmit}>
              Generate
            </Button>
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
