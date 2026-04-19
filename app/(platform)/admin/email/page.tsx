import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BulkEmailForm } from './BulkEmailForm'

export default async function BulkEmailPage() {
  await requireAdmin()

  const supabase = createAdminClient()
  const { count } = await supabase
    .from('teachers')
    .select('*', { count: 'exact', head: true })
    .eq('is_suspended', false)

  const teacherCount = count ?? 0

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-bold">Bulk Email</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send an announcement to all {teacherCount} active teachers.
        </p>
      </div>

      <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-2xl bg-card">
        <CardHeader className="px-6 pt-6 pb-2">
          <CardTitle className="text-base font-semibold">Compose Message</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <BulkEmailForm teacherCount={teacherCount} />
        </CardContent>
      </Card>
    </div>
  )
}
