'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signInAction } from '@/lib/auth/actions'
import { ROUTES } from '@/constants/routes'

type LoginFormProps = {
  action: 'teacher' | 'student'
  redirectTo: string
}

/**
 * LoginForm — uses useActionState with a Server Action for progressive enhancement.
 * The form works as a native <form> submission even before React hydrates,
 * and upgrades to AJAX-style once JS loads. This fixes the iOS Safari issue
 * where React onClick/onSubmit doesn't fire before hydration.
 */
export function LoginForm({ action, redirectTo }: LoginFormProps) {
  const boundAction = signInAction.bind(null, action, redirectTo)
  const [state, formAction, isPending] = useActionState(boundAction, { error: null })

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Enter your password"
          required
          autoComplete="current-password"
        />
      </div>

      <div className="flex items-center justify-end">
        <Link
          href={action === 'student' ? ROUTES.PLATFORM.studentForgotPassword : ROUTES.PLATFORM.forgotPassword}
          className="text-sm text-primary hover:text-primary/90"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" loading={isPending} className="w-full">
        Sign in
      </Button>
    </form>
  )
}
