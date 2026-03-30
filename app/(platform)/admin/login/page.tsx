import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Admin Login — Lumscribe',
  description: 'Sign in to the Lumscribe admin panel.',
}

/**
 * Admin login page — NOT linked from public pages.
 * Uses the same LoginForm with action="teacher" since admin is an auth user
 * with user_metadata.role = 'admin'. The requireAdmin() guard in the layout
 * handles the actual role check.
 */
export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-surface p-8 shadow-card">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-ink">Lumscribe Admin</h1>
            <p className="mt-1 text-sm text-muted">
              Sign in to the admin panel
            </p>
          </div>

          <AdminLoginForm />
        </div>
      </div>
    </main>
  )
}

/**
 * Inline admin login form. We cannot use LoginForm directly because it
 * checks for teacher/student role mismatch. Admin just needs to sign in
 * and be redirected to the admin dashboard.
 */
function AdminLoginForm() {
  return <LoginForm action="teacher" redirectTo={ROUTES.ADMIN.dashboard} />
}
