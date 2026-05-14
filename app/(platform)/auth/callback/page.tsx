'use client'

/**
 * app/(platform)/auth/callback/page.tsx — Email-link auth callback.
 *
 * Supabase Auth's email confirmation / recovery links (generated via
 * generateLink + redirectTo) return tokens in the URL fragment, e.g.
 *   /auth/callback#access_token=...&refresh_token=...&type=signup
 *
 * Fragments never reach the server, so this is a client component that:
 *   1. Parses the hash fragment
 *   2. Calls supabase.auth.setSession() — persists to cookies via @supabase/ssr
 *   3. Routes the user to the right next step based on `type`
 *
 * Sister handler: /api/auth/callback handles the PKCE `?code=...` flow used by
 * Google OAuth. Email confirmations land here.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/supabase/client'
import { ROUTES } from '@/constants/routes'

type CallbackStatus = 'processing' | 'error'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<CallbackStatus>('processing')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function handleCallback() {
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash
      const params = new URLSearchParams(hash)

      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const type = params.get('type')
      const errorDescription = params.get('error_description')

      if (errorDescription) {
        setStatus('error')
        setErrorMessage(errorDescription.replace(/\+/g, ' '))
        return
      }

      if (!accessToken || !refreshToken) {
        setStatus('error')
        setErrorMessage('Confirmation link is missing tokens or has expired. Please request a new one.')
        return
      }

      const supabase = createClient()
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (error) {
        setStatus('error')
        setErrorMessage(error.message)
        return
      }

      // Clean the hash off the URL so the tokens aren't sitting in the address
      // bar / browser history after navigation.
      window.history.replaceState(null, '', window.location.pathname)

      // Route by intent. Server pages will gate further (dashboard layout
      // forwards to onboarding if profile_complete is false).
      if (type === 'recovery') {
        router.replace('/auth/reset-password')
      } else {
        router.replace(ROUTES.TEACHER.dashboard)
      }
    }

    void handleCallback()
  }, [router])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Image src="/icon.png" alt="Skool Rooms" width={40} height={40} className="rounded-lg" />
            <h1 className="text-2xl font-bold text-foreground">Skool Rooms</h1>
          </div>

          {status === 'processing' && (
            <>
              <p className="text-base font-medium text-foreground">Confirming your email…</p>
              <p className="mt-2 text-sm text-muted-foreground">Hang tight, you&apos;ll be signed in in a moment.</p>
            </>
          )}

          {status === 'error' && (
            <>
              <p className="text-base font-semibold text-destructive">We couldn&apos;t confirm your email</p>
              <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
              <a
                href={ROUTES.PLATFORM.login}
                className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                Back to sign in
              </a>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
