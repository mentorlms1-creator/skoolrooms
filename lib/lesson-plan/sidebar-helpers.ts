// =============================================================================
// lib/lesson-plan/sidebar-helpers.ts
// Pure mappers used by the lesson plan workspace pages.
// =============================================================================

import type { LessonPlanRow } from '@/lib/db/lessonPlans'
import type { LessonPlanSidebarItem } from '@/components/teacher/LessonPlanSidebarList'

/** Deterministic 0–7 index derived from the plan id, used to pick an
 *  avatar-* palette token for the thumbnail. */
function paletteIndexForId(id: string): number {
  let sum = 0
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i)
  return sum % 8
}

export function mapPlansToSidebarItems(plans: LessonPlanRow[]): LessonPlanSidebarItem[] {
  return plans.map((p) => ({
    id: p.id,
    title: p.title,
    scope: p.scope as 'session' | 'unit',
    updated_at: p.updated_at,
    themeIndex: paletteIndexForId(p.id),
  }))
}
