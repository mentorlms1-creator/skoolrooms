import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — IMPORTANT: must call getUser() not getSession()
  // getUser() hits the Supabase Auth server and validates the JWT
  await supabase.auth.getUser()

  // --- Subdomain routing ---
  const hostname = request.headers.get('host') || ''
  const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'localhost:3000'

  // Strip port for localhost development
  const normalizedHost = hostname.replace(':3000', '').replace(':3001', '')

  // Skip rewriting for the bare platform domain (skoolrooms.com) and www
  if (
    normalizedHost !== platformDomain &&
    normalizedHost !== `www.${platformDomain}` &&
    normalizedHost !== 'localhost' &&
    normalizedHost !== ''
  ) {
    // students.skoolrooms.com -> rewrite to /student/*
    if (normalizedHost === `students.${platformDomain}`) {
      const url = request.nextUrl.clone()
      url.pathname = `/student${url.pathname}`
      return NextResponse.rewrite(url, {
        request,
        headers: supabaseResponse.headers,
      })
    }

    // {subdomain}.skoolrooms.com -> rewrite to /teacher-public/{subdomain}/*
    const subdomain = normalizedHost.replace(`.${platformDomain}`, '')
    if (subdomain && subdomain !== normalizedHost) {
      const url = request.nextUrl.clone()
      url.pathname = `/teacher-public/${subdomain}${url.pathname}`
      return NextResponse.rewrite(url, {
        request,
        headers: supabaseResponse.headers,
      })
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
