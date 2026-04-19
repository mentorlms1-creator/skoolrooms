// =============================================================================
// lib/db/admin-plans.ts — Plan CRUD + grandfathering queries
// =============================================================================

import { createAdminClient } from '@/supabase/server'

export type PlanRow = {
  id: string
  name: string
  slug: string
  price_pkr: number
  is_active: boolean
  is_visible: boolean
  is_featured: boolean
  display_order: number
  max_courses: number
  max_students: number
  max_cohorts_active: number
  max_storage_mb: number
  max_teachers: number
  trial_days: number
  transaction_cut_percent: number
  created_at: string
  updated_at: string
}

export type PlanFeatureRow = {
  id: string
  plan_id: string
  feature_key: string
  is_enabled: boolean
}

export type FeatureRegistryRow = {
  id: string
  feature_key: string
  display_name: string
  description: string
  category: string
  is_limit_based: boolean
}

export type GrandfatheredTeacherRow = {
  teacherId: string
  teacherName: string
  teacherEmail: string
  plan: string
  snapshotJson: Record<string, unknown>
  capturedAt: string
  currentPlan: {
    maxCourses: number
    maxStudents: number
    maxCohortsActive: number
    maxStorageMb: number
  }
}

export async function getAllPlans(): Promise<PlanRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('display_order')

  if (error || !data) return []

  return data.map(mapPlanRow)
}

export async function getPlanWithFeatures(planId: string): Promise<{
  plan: PlanRow
  features: PlanFeatureRow[]
  featureRegistry: FeatureRegistryRow[]
} | null> {
  const supabase = createAdminClient()

  const [{ data: plan, error }, { data: features }, { data: registry }] = await Promise.all([
    supabase.from('plans').select('*').eq('id', planId).single(),
    supabase.from('plan_features').select('*').eq('plan_id', planId),
    supabase.from('feature_registry').select('*').order('category'),
  ])

  if (error || !plan) return null

  return {
    plan: mapPlanRow(plan),
    features: (features ?? []).map((f) => ({
      id: f.id as string,
      plan_id: f.plan_id as string,
      feature_key: f.feature_key as string,
      is_enabled: f.is_enabled as boolean,
    })),
    featureRegistry: (registry ?? []).map((r) => ({
      id: r.id as string,
      feature_key: r.feature_key as string,
      display_name: r.display_name as string,
      description: r.description as string,
      category: r.category as string,
      is_limit_based: r.is_limit_based as boolean,
    })),
  }
}

export async function getSubscriberCountByPlan(planId: string): Promise<number> {
  const supabase = createAdminClient()

  const { data: plan } = await supabase
    .from('plans')
    .select('slug')
    .eq('id', planId)
    .single()

  if (!plan) return 0

  const { count } = await supabase
    .from('teachers')
    .select('*', { count: 'exact', head: true })
    .eq('plan', plan.slug as string)
    .neq('plan', 'free')

  return count ?? 0
}

export type CreatePlanInput = {
  name: string
  slug: string
  price_pkr: number
  display_order: number
  max_courses: number
  max_students: number
  max_cohorts_active: number
  max_storage_mb: number
  max_teachers: number
  trial_days: number
  transaction_cut_percent: number
}

export async function createPlan(input: CreatePlanInput): Promise<PlanRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('plans')
    .insert({
      ...input,
      is_active: true,
      is_visible: true,
      is_featured: false,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return mapPlanRow(data)
}

export type UpdatePlanInput = Partial<{
  name: string
  price_pkr: number
  is_featured: boolean
  display_order: number
  max_courses: number
  max_students: number
  max_cohorts_active: number
  max_storage_mb: number
  max_teachers: number
  trial_days: number
  transaction_cut_percent: number
  features: Record<string, boolean>
}>

export async function updatePlan(
  planId: string,
  input: UpdatePlanInput
): Promise<{ plan: PlanRow; affectedCount: number } | null> {
  const supabase = createAdminClient()

  const { data: existing, error: fetchError } = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .single()

  if (fetchError || !existing) return null

  const { features, ...planFields } = input

  // Update plan row
  const { data: updated, error: updateError } = await supabase
    .from('plans')
    .update({ ...planFields, updated_at: new Date().toISOString() })
    .eq('id', planId)
    .select('*')
    .single()

  if (updateError || !updated) return null

  // Update plan_features
  if (features) {
    for (const [featureKey, isEnabled] of Object.entries(features)) {
      await supabase
        .from('plan_features')
        .upsert({ plan_id: planId, feature_key: featureKey, is_enabled: isEnabled })
    }
  }

  // Grandfathering check: find teachers whose usage exceeds lowered limits
  let affectedCount = 0
  const limitsToCheck = ['max_courses', 'max_students', 'max_cohorts_active', 'max_storage_mb'] as const
  const plan = mapPlanRow(updated)

  const { data: teachersOnPlan } = await supabase
    .from('teachers')
    .select('id')
    .eq('plan', existing.slug as string)

  if (teachersOnPlan && teachersOnPlan.length > 0) {
    for (const t of teachersOnPlan) {
      const teacherId = t.id as string
      let needsSnapshot = false

      for (const limit of limitsToCheck) {
        const oldLimit = existing[limit] as number
        const newLimit = plan[limit] as number
        if (newLimit < oldLimit) {
          needsSnapshot = true
          break
        }
      }

      if (needsSnapshot) {
        await supabase.from('teacher_plan_snapshot').insert({
          teacher_id: teacherId,
          plan_id: planId,
          snapshot_json: {
            max_courses: existing.max_courses,
            max_students: existing.max_students,
            max_cohorts_active: existing.max_cohorts_active,
            max_storage_mb: existing.max_storage_mb,
            max_teachers: existing.max_teachers,
          },
          captured_at: new Date().toISOString(),
        })
        affectedCount++
      }
    }
  }

  return { plan, affectedCount }
}

export async function archivePlan(planId: string): Promise<boolean> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('plans')
    .update({ is_active: false, is_visible: false, updated_at: new Date().toISOString() })
    .eq('id', planId)

  return !error
}

export async function deletePlan(planId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()

  const count = await getSubscriberCountByPlan(planId)
  if (count > 0) {
    return { success: false, error: 'PLAN_HAS_SUBSCRIBERS' }
  }

  // Delete plan_features first
  await supabase.from('plan_features').delete().eq('plan_id', planId)

  const { error } = await supabase.from('plans').delete().eq('id', planId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function getGrandfatheredTeachers(): Promise<GrandfatheredTeacherRow[]> {
  const supabase = createAdminClient()

  const { data: snapshots } = await supabase
    .from('teacher_plan_snapshot')
    .select('teacher_id, plan_id, snapshot_json, captured_at')
    .order('captured_at', { ascending: false })

  if (!snapshots || snapshots.length === 0) return []

  const teacherIds = [...new Set(snapshots.map((s) => s.teacher_id as string))]
  const planIds = [...new Set(snapshots.map((s) => s.plan_id as string))]

  const [{ data: teachers }, { data: plans }] = await Promise.all([
    supabase.from('teachers').select('id, name, email, plan').in('id', teacherIds),
    supabase
      .from('plans')
      .select('id, max_courses, max_students, max_cohorts_active, max_storage_mb')
      .in('id', planIds),
  ])

  const teacherMap = new Map((teachers ?? []).map((t) => [t.id as string, t]))
  const planMap = new Map((plans ?? []).map((p) => [p.id as string, p]))

  const results: GrandfatheredTeacherRow[] = []

  for (const snap of snapshots) {
    const teacher = teacherMap.get(snap.teacher_id as string)
    const plan = planMap.get(snap.plan_id as string)
    if (!teacher || !plan) continue

    const snapshotJson = snap.snapshot_json as Record<string, unknown>
    const snapMax = (key: string) => Number(snapshotJson[key] ?? 0)
    const planMax = (key: keyof typeof plan) => Number(plan[key] ?? 0)

    // Only include if snapshot limits exceed current plan limits
    const isGrandfathered =
      snapMax('max_courses') > planMax('max_courses') ||
      snapMax('max_students') > planMax('max_students') ||
      snapMax('max_cohorts_active') > planMax('max_cohorts_active') ||
      snapMax('max_storage_mb') > planMax('max_storage_mb')

    if (!isGrandfathered) continue

    results.push({
      teacherId: snap.teacher_id as string,
      teacherName: teacher.name as string,
      teacherEmail: teacher.email as string,
      plan: teacher.plan as string,
      snapshotJson,
      capturedAt: snap.captured_at as string,
      currentPlan: {
        maxCourses: planMax('max_courses'),
        maxStudents: planMax('max_students'),
        maxCohortsActive: planMax('max_cohorts_active'),
        maxStorageMb: planMax('max_storage_mb'),
      },
    })
  }

  return results
}

function mapPlanRow(data: Record<string, unknown>): PlanRow {
  return {
    id: data.id as string,
    name: data.name as string,
    slug: data.slug as string,
    price_pkr: data.price_pkr as number,
    is_active: data.is_active as boolean,
    is_visible: data.is_visible as boolean,
    is_featured: data.is_featured as boolean,
    display_order: data.display_order as number,
    max_courses: data.max_courses as number,
    max_students: data.max_students as number,
    max_cohorts_active: data.max_cohorts_active as number,
    max_storage_mb: data.max_storage_mb as number,
    max_teachers: data.max_teachers as number,
    trial_days: data.trial_days as number,
    transaction_cut_percent: Number(data.transaction_cut_percent),
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  }
}
