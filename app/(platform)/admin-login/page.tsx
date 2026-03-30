import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Admin Login — Lumscribe',
}

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-surface p-8 shadow-card">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-ink">Lumscribe Admin</h1>
            <p className="mt-1 text-sm text-muted">Sign in to the admin panel</p>
          </div>
          <LoginForm action="teacher" redirectTo="/admin" />
        </div>
      </div>
    </main>
  )
}
