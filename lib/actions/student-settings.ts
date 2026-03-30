'use server'

import { createClient } from '@/supabase/server'
import { createAdminClient } from '@/supabase/server'
import { getStudentByAuthId } from '@/lib/db/students'
import { updateStudent } from '@/lib/db/students'
import type { ApiResponse } from '@/types/api'

export async function updateStudentProfileAction(
  formData: FormData
): Promise<ApiResponse<null>> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { success: false, error: 'Not authenticated' }

  const student = await getStudentByAuthId(user.id)
  if (!student) return { success: false, error: 'Student not found' }

  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()

  if (!name || name.length < 2) {
    return { success: false, error: 'Name must be at least 2 characters' }
  }
  if (!phone) {
    return { success: false, error: 'Phone number is required' }
  }

  await updateStudent(student.id, { name, phone })

  return { success: true, data: null }
}
