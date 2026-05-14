'use client'

import { useState, useEffect } from 'react'
import { User, Mail, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signUpTeacher } from '@/lib/auth/actions'
import { cn } from '@/lib/utils'

type FieldProps = {
  id: string
  name: string
  type: string
  placeholder: string
  autoComplete?: string
  icon: React.ReactNode
  error?: string
}

function Field({ id, name, type, placeholder, autoComplete, icon, error }: FieldProps) {
  return (
    <div>
      <div
        className={cn(
          'group relative flex items-center rounded-2xl border border-border bg-background/60 transition-all',
          'focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15',
          error && 'border-destructive focus-within:border-destructive focus-within:ring-destructive/20',
        )}
      >
        <span className="pointer-events-none flex h-12 w-12 items-center justify-center text-primary">
          {icon}
        </span>
        <input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          required
          autoComplete={autoComplete}
          className="peer h-12 w-full bg-transparent pr-4 text-sm text-foreground placeholder:text-muted-foreground/80 outline-none"
        />
      </div>
      {error && <p className="mt-1.5 pl-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function SignupForm() {
  const [error, setError] = useState<string | null>(null)
  const [ref, setRef] = useState<string | null>(null)

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref')
    if (code) setRef(code)
  }, [])

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
        <h3 className="text-lg font-semibold text-foreground">Check your email</h3>
        <p className="text-sm text-muted-foreground">
          We&apos;ve sent a verification link to your email address. Please click
          the link to verify your account and get started.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      {ref && <input type="hidden" name="ref" value={ref} />}
      {error && (
        <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Field
        id="name"
        name="name"
        type="text"
        placeholder="Full name"
        autoComplete="name"
        icon={<User className="h-5 w-5" strokeWidth={1.75} />}
        error={fieldErrors.name}
      />

      <Field
        id="email"
        name="email"
        type="email"
        placeholder="Email"
        autoComplete="email"
        icon={<Mail className="h-5 w-5" strokeWidth={1.75} />}
      />

      <Field
        id="password"
        name="password"
        type="password"
        placeholder="Password"
        autoComplete="new-password"
        icon={<Lock className="h-5 w-5" strokeWidth={1.75} />}
        error={fieldErrors.password}
      />

      <Field
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        placeholder="Confirm password"
        autoComplete="new-password"
        icon={<Lock className="h-5 w-5" strokeWidth={1.75} />}
        error={fieldErrors.confirmPassword}
      />

      <Button
        type="submit"
        loading={loading}
        className="mt-2 h-12 w-full rounded-2xl text-sm font-semibold shadow-[0_10px_30px_-12px_oklch(0.55_0.25_285_/_0.55)]"
      >
        Create account
      </Button>
    </form>
  )
}
