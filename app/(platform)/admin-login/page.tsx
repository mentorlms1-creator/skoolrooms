import type { Metadata } from 'next'
import Image from 'next/image'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Admin Login — Skool Rooms',
}

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
          <div className="flex items-center justify-center gap-2 mb-8">
            <Image src="/icon.png" alt="Skool Rooms" width={40} height={40} className="rounded-lg" />
            <h1 className="text-2xl font-bold text-foreground">Skool Rooms Admin</h1>
          </div>
          <p className="mt-[-1.5rem] mb-8 text-center text-sm text-muted-foreground">Sign in to the admin panel</p>
          <LoginForm action="teacher" redirectTo="/admin" />
        </div>
      </div>
    </main>
  )
}
