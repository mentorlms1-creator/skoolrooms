import { createClient } from '@/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Auth callback handler for Supabase email verification and password reset.
 *
 * Supabase sends the user here with a `code` query param after they click
 * a verification or reset link in their email. We exchange the code for a
 * session, then redirect to the appropriate page.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // If no code or exchange failed, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
