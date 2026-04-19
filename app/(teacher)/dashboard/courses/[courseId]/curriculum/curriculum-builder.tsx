'use client'

/**
 * app/(teacher)/dashboard/courses/[courseId]/curriculum/curriculum-builder.tsx
 * Client Component — Inline CRUD + reorder for course curriculum items.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from 'sonner'
import { useUIContext } from '@/providers/UIProvider'
import {
  createCurriculumItemAction,
  updateCurriculumItemAction,
  deleteCurriculumItemAction,
  reorderCurriculumItemsAction,
} from '@/lib/actions/course-curriculum'
import type { CurriculumItem } from '@/lib/db/course-curriculum'

type Props = {
  courseId: string
  initialItems: CurriculumItem[]
}

export function CurriculumBuilder({ courseId, initialItems }: Props) {
  const router = useRouter()
  const { confirm } = useUIContext()
  const [isPending, startTransition] = useTransition()
  const [items, setItems] = useState<CurriculumItem[]>(initialItems)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  function refresh() {
    router.refresh()
  }

  function handleAdd(formData: FormData) {
    startTransition(async () => {
      const result = await createCurriculumItemAction(courseId, formData)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Item added.')
      setAdding(false)
      refresh()
    })
  }

  function handleUpdate(itemId: string, formData: FormData) {
    startTransition(async () => {
      const result = await updateCurriculumItemAction(itemId, courseId, formData)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Item updated.')
      setEditingId(null)
      refresh()
    })
  }

  function handleDelete(itemId: string) {
    confirm({
      title: 'Delete item',
      message: 'Remove this curriculum item? Students will no longer see it.',
      confirmText: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        const result = await deleteCurriculumItemAction(itemId, courseId)
        if (!result.success) {
          toast.error(result.error)
          return
        }
        toast.success('Item deleted.')
        setItems((prev) => prev.filter((i) => i.id !== itemId))
        refresh()
      },
    })
  }

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= items.length) return

    const next = items.slice()
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    const previous = items
    setItems(next)

    startTransition(async () => {
      const result = await reorderCurriculumItemsAction(
        courseId,
        next.map((i) => i.id),
      )
      if (!result.success) {
        toast.error(result.error)
        setItems(previous)
        return
      }
      refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length === 0
            ? 'No outline yet.'
            : `${items.length} item${items.length === 1 ? '' : 's'}.`}
        </p>
        {!adding && (
          <Button onClick={() => setAdding(true)} disabled={isPending}>
            Add Week
          </Button>
        )}
      </div>

      {adding && (
        <ItemForm
          submitLabel="Add"
          isPending={isPending}
          defaultWeekNumber={items.length + 1}
          onCancel={() => setAdding(false)}
          onSubmit={handleAdd}
        />
      )}

      {items.length === 0 && !adding ? (
        <EmptyState
          title="No outline yet"
          description="Build a weekly outline so students know what they're signing up for."
          action={
            <Button onClick={() => setAdding(true)}>Add first week</Button>
          }
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {items.map((item, idx) => (
            <li
              key={item.id}
              className="rounded-md border border-border bg-card p-4"
            >
              {editingId === item.id ? (
                <ItemForm
                  submitLabel="Save"
                  isPending={isPending}
                  defaultWeekNumber={item.week_number}
                  defaultTitle={item.title}
                  defaultDescription={item.description ?? ''}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(fd) => handleUpdate(item.id, fd)}
                />
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => handleMove(idx, -1)}
                      disabled={idx === 0 || isPending}
                      className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                      aria-label="Move up"
                    >
                      &uarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(idx, 1)}
                      disabled={idx === items.length - 1 || isPending}
                      className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                      aria-label="Move down"
                    >
                      &darr;
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      Week {item.week_number}: {item.title}
                    </p>
                    {item.description && (
                      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(item.id)}
                      disabled={isPending}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                      disabled={isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

type ItemFormProps = {
  submitLabel: string
  isPending: boolean
  defaultWeekNumber: number
  defaultTitle?: string
  defaultDescription?: string
  onSubmit: (formData: FormData) => void
  onCancel: () => void
}

function ItemForm({
  submitLabel,
  isPending,
  defaultWeekNumber,
  defaultTitle,
  defaultDescription,
  onSubmit,
  onCancel,
}: ItemFormProps) {
  const [weekNumber, setWeekNumber] = useState(String(defaultWeekNumber))
  const [title, setTitle] = useState(defaultTitle ?? '')
  const [description, setDescription] = useState(defaultDescription ?? '')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData()
        fd.set('week_number', weekNumber)
        fd.set('title', title)
        fd.set('description', description)
        onSubmit(fd)
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[100px_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="curriculum-week">Week #</Label>
          <Input
            id="curriculum-week"
            type="number"
            min={1}
            value={weekNumber}
            onChange={(e) => setWeekNumber(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="curriculum-title">Title</Label>
          <Input
            id="curriculum-title"
            placeholder="e.g. Quadratic Equations"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="curriculum-description">Description (optional)</Label>
        <Textarea
          id="curriculum-description"
          placeholder="Topics covered, key activities, learning outcomes..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
