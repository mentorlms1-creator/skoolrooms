'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PlanPreviewCard } from './PlanPreviewCard'
import { updatePlanAction, archivePlanAction, deletePlanAction } from '@/lib/actions/admin-plans'
import type { PlanRow, PlanFeatureRow, FeatureRegistryRow } from '@/lib/db/admin-plans'

type PlanEditFormProps = {
  plan: PlanRow
  features: PlanFeatureRow[]
  featureRegistry: FeatureRegistryRow[]
  subscriberCount: number
}

export function PlanEditForm({ plan, features, featureRegistry, subscriberCount }: PlanEditFormProps) {
  const router = useRouter()

  const initialFeatures = Object.fromEntries(
    featureRegistry.map((r) => [
      r.feature_key,
      features.find((f) => f.feature_key === r.feature_key)?.is_enabled ?? false,
    ])
  )

  const [values, setValues] = useState({
    name: plan.name,
    price_pkr: plan.price_pkr,
    max_courses: plan.max_courses,
    max_students: plan.max_students,
    max_cohorts_active: plan.max_cohorts_active,
    max_storage_mb: plan.max_storage_mb,
    max_teachers: plan.max_teachers,
    transaction_cut_percent: plan.transaction_cut_percent,
    trial_days: plan.trial_days,
    features: initialFeatures,
  })

  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showGrandfatheredModal, setShowGrandfatheredModal] = useState(false)
  const [affectedCount, setAffectedCount] = useState(0)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  function setField<K extends keyof typeof values>(key: K, value: typeof values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading('save')
    setMessage(null)

    const result = await updatePlanAction(plan.id, {
      name: values.name,
      price_pkr: values.price_pkr,
      max_courses: values.max_courses,
      max_students: values.max_students,
      max_cohorts_active: values.max_cohorts_active,
      max_storage_mb: values.max_storage_mb,
      max_teachers: values.max_teachers,
      transaction_cut_percent: values.transaction_cut_percent,
      trial_days: values.trial_days,
      features: values.features,
    })

    if (result.success) {
      if (result.data.affectedCount > 0) {
        setAffectedCount(result.data.affectedCount)
        setShowGrandfatheredModal(true)
      } else {
        setMessage({ type: 'success', text: 'Plan updated.' })
      }
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error })
    }

    setLoading(null)
  }

  async function handleArchive() {
    setShowArchiveConfirm(false)
    setLoading('archive')

    const result = await archivePlanAction(plan.id)
    if (result.success) {
      router.push('/admin/plans')
    } else {
      setMessage({ type: 'error', text: result.error })
      setLoading(null)
    }
  }

  async function handleDelete() {
    setShowDeleteConfirm(false)
    setLoading('delete')

    const result = await deletePlanAction(plan.id)
    if (result.success) {
      router.push('/admin/plans')
    } else {
      setMessage({ type: 'error', text: result.error })
      setLoading(null)
    }
  }

  const featuresByCategory = featureRegistry.reduce<Record<string, FeatureRegistryRow[]>>(
    (acc, f) => {
      acc[f.category] = [...(acc[f.category] ?? []), f]
      return acc
    },
    {}
  )

  return (
    <>
      {message && (
        <div
          className={`mb-5 rounded-2xl px-5 py-4 text-sm font-medium ${
            message.type === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Edit form — left column */}
        <form onSubmit={handleSave} className="space-y-6">
          {/* Slug — read-only */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
              Slug (read-only)
            </label>
            <Input
              value={plan.slug}
              readOnly
              disabled
              title="Slug cannot be changed after plan creation. Archive and create a new plan to change slug."
              className="font-mono opacity-60"
            />
            <p className="text-[11px] text-muted-foreground">
              Slug cannot be changed after creation.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
              Name
            </label>
            <Input
              value={values.name}
              onChange={(e) => setField('name', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                Price (PKR/mo)
              </label>
              <Input
                type="number"
                min={0}
                value={values.price_pkr}
                onChange={(e) => setField('price_pkr', Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                Platform Cut (%)
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={values.transaction_cut_percent}
                onChange={(e) => setField('transaction_cut_percent', Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                Max Courses
              </label>
              <Input
                type="number"
                min={1}
                value={values.max_courses}
                onChange={(e) => setField('max_courses', Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                Max Students
              </label>
              <Input
                type="number"
                min={1}
                value={values.max_students}
                onChange={(e) => setField('max_students', Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                Max Active Cohorts
              </label>
              <Input
                type="number"
                min={1}
                value={values.max_cohorts_active}
                onChange={(e) => setField('max_cohorts_active', Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                Max Storage (MB)
              </label>
              <Input
                type="number"
                min={1}
                value={values.max_storage_mb}
                onChange={(e) => setField('max_storage_mb', Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                Max Teachers
              </label>
              <Input
                type="number"
                min={1}
                value={values.max_teachers}
                onChange={(e) => setField('max_teachers', Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                Trial Days
              </label>
              <Input
                type="number"
                min={0}
                value={values.trial_days}
                onChange={(e) => setField('trial_days', Number(e.target.value))}
              />
            </div>
          </div>

          {/* Features by category */}
          {Object.entries(featuresByCategory).map(([category, categoryFeatures]) => (
            <div key={category} className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                {category}
              </h3>
              <div className="space-y-2 rounded-xl bg-muted p-3">
                {categoryFeatures.map((f) => (
                  <label
                    key={f.feature_key}
                    className="flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{f.display_name}</p>
                      <p className="text-xs text-muted-foreground">{f.description}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={values.features[f.feature_key] ?? false}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          features: { ...prev.features, [f.feature_key]: e.target.checked },
                        }))
                      }
                      className="h-4 w-4 rounded"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              variant="primary"
              loading={loading === 'save'}
              className="flex-1"
            >
              Save Changes
            </Button>
          </div>

          {/* Danger zone */}
          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-destructive/70">
              Danger Zone
            </h3>
            <div className="flex gap-2">
              {plan.is_active && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={loading === 'archive'}
                  onClick={() => setShowArchiveConfirm(true)}
                  className="flex-1"
                >
                  Archive Plan
                </Button>
              )}
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={loading === 'delete'}
                onClick={() => setShowDeleteConfirm(true)}
                disabled={subscriberCount > 0}
                className="flex-1"
                title={
                  subscriberCount > 0
                    ? `Cannot delete — ${subscriberCount} active subscribers`
                    : 'Delete plan permanently'
                }
              >
                Delete Plan
              </Button>
            </div>
            {subscriberCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {subscriberCount} active subscribers — archive instead of deleting.
              </p>
            )}
          </div>
        </form>

        {/* Live preview — right column */}
        <div className="sticky top-4">
          <PlanPreviewCard values={values} />
        </div>
      </div>

      {/* Grandfathering modal */}
      <Dialog open={showGrandfatheredModal} onOpenChange={setShowGrandfatheredModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Plan limits lowered</DialogTitle>
            <DialogDescription>
              {affectedCount} teacher{affectedCount !== 1 ? 's' : ''} on this plan have usage that
              exceeds the new limits. Their current allowances have been snapshotted and they will
              keep the old (higher) limits until they change plans.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowGrandfatheredModal(false)} variant="primary">
              OK, understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirm */}
      <Dialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this plan?</DialogTitle>
            <DialogDescription>
              Archiving hides this plan from new signups and the pricing page. Existing subscribers
              keep their plan. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowArchiveConfirm(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleArchive}>
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete plan?</DialogTitle>
            <DialogDescription>
              This will permanently delete the plan and all its feature settings. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
