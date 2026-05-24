'use server'

// =============================================================================
// lib/actions/admin-search.ts — Server action for the admin command palette
// global search. Authenticates the caller as admin before hitting the DB.
// =============================================================================

import { requireAdmin } from '@/lib/auth/guards'
import { searchAdminEntities, type AdminSearchHit } from '@/lib/db/admin-dashboard'

export async function searchAdminEntitiesAction(query: string): Promise<AdminSearchHit[]> {
  await requireAdmin()
  return searchAdminEntities(query)
}
