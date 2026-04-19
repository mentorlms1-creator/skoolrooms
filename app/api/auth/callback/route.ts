import { createClient, createAdminClient } from '@/supabase/server'
import { NextResponse } from 'next/server'
import { convertReferralAction } from '@/lib/actions/referrals'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const provider = searchParams.get('provider') // 'google' | null
  const ref = searchParams.get('ref') // referral code, threaded through OAuth round-trip

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      if (provider === 'google') {
        const supabaseAdmin = createAdminClient()

        // Check if teacher row already exists for this Google auth user
        const { data: teacher } = await supabaseAdmin
          .from('teachers')
          .select('id, supabase_auth_id, onboarding_completed')
          .eq('supabase_auth_id', data.user.id)
          .maybeSingle()

        if (!teacher) {
          const email = data.user.email!

          // Check if an email+password teacher exists with this email — link them
          const { data: existingTeacher } = await supabaseAdmin
            .from('teachers')
            .select('id, supabase_auth_id')
            .eq('email', email)
            .maybeSingle()

          if (existingTeacher) {
            // Link the existing teacher row to this Google auth user
            await supabaseAdmin
              .from('teachers')
              .update({ supabase_auth_id: data.user.id })
              .eq('id', existingTeacher.id)
            // Ensure teacher_balances row exists (idempotent)
            await supabaseAdmin
              .from('teacher_balances')
              .upsert({ teacher_id: existingTeacher.id }, { onConflict: 'teacher_id' })
            return NextResponse.redirect(`${origin}/dashboard`)
          }

          // Brand new teacher via Google — create teachers + teacher_balances rows
          const name =
            (data.user.user_metadata?.full_name as string) ||
            email.split('@')[0]

          const { data: newTeacher } = await supabaseAdmin
            .from('teachers')
            .insert({
              supabase_auth_id: data.user.id,
              name,
              email,
              subdomain: `_pending_${crypto.randomUUID()}`,
              plan: 'free',
              onboarding_completed: false,
            })
            .select('id')
            .single()

          if (newTeacher) {
            await supabaseAdmin
              .from('teacher_balances')
              .insert({ teacher_id: newTeacher.id })

            if (ref) {
              await convertReferralAction(ref, newTeacher.id)
            }
          }

          // Redirect to onboarding with Google profile pre-fill
          const onboardingUrl = new URL(`${origin}/onboarding/step-1`)
          onboardingUrl.searchParams.set('name', name)
          onboardingUrl.searchParams.set('email', email)
          return NextResponse.redirect(onboardingUrl.toString())
        }

        // Existing Google teacher
        if (!teacher.onboarding_completed) {
          return NextResponse.redirect(`${origin}/onboarding/step-1`)
        }
        return NextResponse.redirect(`${origin}/dashboard`)
      }

      // Non-OAuth path (email verification / password reset) — original behavior
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
