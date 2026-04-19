'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { bulkEmailTeachersAction } from '@/lib/actions/admin-email'

const BREVO_DAILY_LIMIT = 300

type BulkEmailFormProps = {
  teacherCount: number
}

export function BulkEmailForm({ teacherCount }: BulkEmailFormProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const overLimit = teacherCount > BREVO_DAILY_LIMIT

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (overLimit) return
    setResult(null)
    setShowConfirm(true)
  }

  async function handleConfirm() {
    setShowConfirm(false)
    setLoading(true)
    setResult(null)

    const fd = new FormData()
    fd.set('subject', subject)
    fd.set('body', body)

    const res = await bulkEmailTeachersAction(fd)

    if (res.success) {
      setResult({ type: 'success', text: `Sent to ${res.data.sent} teachers.` })
      setSubject('')
      setBody('')
    } else {
      setResult({ type: 'error', text: res.error })
    }
    setLoading(false)
  }

  return (
    <>
      {overLimit && (
        <div className="mb-5 rounded-2xl bg-destructive/10 px-5 py-4 text-sm text-destructive">
          Warning: {teacherCount} teachers exceed Brevo daily limit of {BREVO_DAILY_LIMIT}. Upgrade
          your Brevo plan to enable bulk email.
        </div>
      )}

      {result && (
        <div
          className={`mb-5 rounded-2xl px-5 py-4 text-sm font-medium ${
            result.type === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {result.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
            Subject
          </label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder="Important update about Skool Rooms"
            required
            disabled={overLimit || loading}
          />
          <p className="text-right text-[11px] text-muted-foreground">{subject.length}/200</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
            Body
          </label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            placeholder="Write your message here…"
            rows={10}
            required
            disabled={overLimit || loading}
            className="resize-y"
          />
          <p className="text-right text-[11px] text-muted-foreground">{body.length}/5000</p>
        </div>

        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={overLimit || !subject.trim() || !body.trim()}
          className="w-full"
        >
          Send to {teacherCount} teachers
        </Button>
      </form>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send bulk email?</DialogTitle>
            <DialogDescription>
              This will send an email to <strong>{teacherCount} teachers</strong>. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="my-2 rounded-xl bg-muted px-4 py-3 text-sm">
            <strong>Subject:</strong> {subject}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirm}>
              Confirm & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
