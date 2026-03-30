'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { signUpTeacher } from '@/lib/auth/actions'

export function SignupForm() {
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  function validate(formData: FormData): boolean {
    const errors: Record<string, string> = {}
    const name = formData.get('name') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (!name || name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters'
    }
    if (!password || password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    const formData = new FormData(e.currentTarget)

    if (!validate(formData)) {
      return
    }

    setLoading(true)
    const result = await signUpTeacher(formData)

    if (!result.success) {
      setError(result.error)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <svg
            className="h-6 w-6 text-success"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-ink">Check your email</h3>
        <p className="text-sm text-muted">
          We&apos;ve sent a verification link to your email address. Please click
          the link to verify your account and get started.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Input
        label="Full name"
        name="name"
        type="text"
        placeholder="Your full name"
        required
        autoComplete="name"
        error={fieldErrors.name}
      />

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
        placeholder="At least 8 characters"
        required
        autoComplete="new-password"
        error={fieldErrors.password}
      />

      <Input
        label="Confirm password"
        name="confirmPassword"
        type="password"
        placeholder="Re-enter your password"
        required
        autoComplete="new-password"
        error={fieldErrors.confirmPassword}
      />

      <Button type="submit" loading={loading} className="w-full">
        Create account
      </Button>
    </form>
  )
}
