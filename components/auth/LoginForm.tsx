'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { signIn } from '@/lib/auth/actions'
import { ROUTES } from '@/constants/routes'

type LoginFormProps = {
  action: 'teacher' | 'student'
  redirectTo: string
}

export function LoginForm({ action, redirectTo }: LoginFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await signIn(formData)

    if (!result.success) {
      setError(result.error)
      setLoading(false)
      return
    }

    const { role } = result.data

    // Verify the user is logging into the correct portal
    if (action === 'teacher' && role === 'student') {
      setError('This is the teacher login. Please use the student portal to sign in.')
      setLoading(false)
      return
    }
    if (action === 'student' && role === 'teacher') {
      setError('This is the student portal. Please use the teacher login to sign in.')
      setLoading(false)
      return
    }

    router.push(redirectTo)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Input
        label="Email"
        name="email"
        type="email"
        placeholder="you@example.com"
        required
        autoComplete="email"
      />

      <Input
        label="Password"
        name="password"
        type="password"
        placeholder="Enter your password"
        required
        autoComplete="current-password"
      />

      <div className="flex items-center justify-end">
        <Link
          href={ROUTES.PLATFORM.forgotPassword}
          className="text-sm text-brand-600 hover:text-brand-500"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" loading={loading} className="w-full">
        Sign in
      </Button>
    </form>
  )
}
