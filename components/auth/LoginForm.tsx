'use client'

import { useActionState, useState } from 'react'
import { Link } from 'next-view-transitions'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signInAction } from '@/lib/auth/actions'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/lib/utils'

type LoginFormProps = {
  action: 'teacher' | 'student'
  redirectTo: string
}

type FieldProps = {
  id: string
  name: string
  type: string
  placeholder: string
  autoComplete?: string
  icon: React.ReactNode
}

function Field({ id, name, type, placeholder, autoComplete, icon }: FieldProps) {
  const isPassword = type === 'password'
  const [visible, setVisible] = useState(false)
  const inputType = isPassword && visible ? 'text' : type

  return (
    <div
      className={cn(
        'group relative flex items-center rounded-2xl border border-border bg-background/60 transition-all',
        'focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15',
      )}
    >
      <span className="pointer-events-none flex h-12 w-12 items-center justify-center text-primary">
        {icon}
      </span>
      <input
        id={id}
        name={name}
        type={inputType}
        placeholder={placeholder}
        required
        autoComplete={autoComplete}
        className={cn(
          'h-12 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 outline-none',
          isPassword ? 'pr-12' : 'pr-4',
        )}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute right-0 flex h-12 w-12 items-center justify-center rounded-r-2xl text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:text-foreground"
        >
          {visible ? (
            <EyeOff className="h-5 w-5" strokeWidth={1.75} />
          ) : (
            <Eye className="h-5 w-5" strokeWidth={1.75} />
          )}
        </button>
      )}
    </div>
  )
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
    <form action={formAction} className="flex flex-col gap-3.5">
      {state?.error && (
        <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

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
        autoComplete="current-password"
        icon={<Lock className="h-5 w-5" strokeWidth={1.75} />}
      />

      <div className="flex items-center justify-end pt-1">
        <Link
          href={action === 'student' ? ROUTES.PLATFORM.studentForgotPassword : ROUTES.PLATFORM.forgotPassword}
          className="text-sm font-medium text-primary hover:text-primary/80"
        >
          Forgot password?
        </Link>
      </div>

      <Button
        type="submit"
        loading={isPending}
        className="mt-1 h-12 w-full rounded-2xl text-sm font-semibold shadow-[0_10px_30px_-12px_oklch(0.55_0.25_285_/_0.55)]"
      >
        Sign in
      </Button>
    </form>
  )
}
