import type { Metadata } from 'next'
import { Link } from 'next-view-transitions'
import Image from 'next/image'
import { LoginForm } from '@/components/auth/LoginForm'
import { GoogleOAuthButton } from '@/components/auth/GoogleOAuthButton'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Teacher Sign in — Skool Rooms',
  description: 'Sign in to your Skool Rooms teacher dashboard.',
}

export default function TeacherLoginPage() {
  return (
    <main className="relative min-h-dvh w-full lg:grid lg:grid-cols-[1.1fr_1fr] xl:grid-cols-[1.25fr_1fr]">
      {/* MOBILE-ONLY back-to-home brand link */}
      <Link
        href={ROUTES.PLATFORM.home}
        className="absolute left-5 top-5 z-20 flex items-center gap-2 rounded-full border border-white/40 bg-card/65 px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm backdrop-blur-md transition-opacity hover:opacity-90 lg:hidden"
      >
        <Image
          src="/icon.png"
          alt=""
          width={20}
          height={20}
          className="rounded"
        />
        <span>Skool Rooms</span>
      </Link>

      {/* MOBILE-ONLY full-bleed background image */}
      <div
        className="pointer-events-none absolute inset-0 lg:hidden"
        style={{ backgroundColor: 'oklch(0.93 0.035 300)' }}
      >
        <Image
          src="/skoolrooms%20bg.png"
          alt=""
          fill
          priority
          quality={90}
          sizes="100vw"
          className="object-cover object-bottom"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/10 to-white/40" />
      </div>

      {/* LEFT — atmospheric hero (desktop only) */}
      <section
        className="relative hidden overflow-hidden lg:block"
        style={{ backgroundColor: 'oklch(0.93 0.035 300)' }}
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[65%] sm:h-[68%] lg:h-[62%] xl:h-[58%]">
          <Image
            src="/skoolrooms%20bg.png"
            alt=""
            fill
            priority
            quality={95}
            sizes="(min-width: 1280px) 56vw, (min-width: 1024px) 52vw, 100vw"
            className="object-cover object-bottom"
          />
          <div
            className="absolute inset-x-0 top-0 h-24"
            style={{
              background:
                'linear-gradient(to bottom, oklch(0.93 0.035 300) 0%, oklch(0.93 0.035 300 / 0) 100%)',
            }}
          />
        </div>

        <div className="relative z-10 flex min-h-dvh flex-col px-8 py-10 sm:px-14 lg:px-20 lg:py-14">
          <Link
            href={ROUTES.PLATFORM.home}
            className="flex w-fit items-center gap-3 rounded-md transition-opacity hover:opacity-80"
          >
            <Image
              src="/icon.png"
              alt="Skool Rooms"
              width={36}
              height={36}
              className="rounded-md shadow-sm"
            />
            <span className="text-base font-semibold tracking-tight text-foreground">
              Skool Rooms
            </span>
          </Link>

          <div className="mt-12 max-w-xl sm:mt-16 lg:mt-20">
            <h1 className="font-display text-5xl font-bold leading-[0.95] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Welcome
              <br />
              back to your
              <br />
              <span className="text-primary">classroom.</span>
            </h1>
            <p className="mt-7 max-w-md text-base leading-relaxed text-foreground/70 sm:text-lg">
              Sign in to manage your courses, schedule sessions, and keep your
              students moving forward.
            </p>
          </div>
        </div>
      </section>

      {/* RIGHT — form card */}
      <section className="relative flex min-h-dvh items-center justify-center px-4 py-10 sm:px-8 lg:min-h-0 lg:bg-card lg:px-10 lg:py-12 lg:rounded-l-[2.5rem] lg:shadow-[-24px_0_60px_-30px_rgba(60,40,120,0.25)]">
        <div
          className={[
            'w-full max-w-md rounded-3xl border border-white/40 bg-card/65 p-6 shadow-[0_20px_60px_-20px_rgba(60,40,120,0.35)] backdrop-blur-2xl backdrop-saturate-150 sm:p-8',
            'lg:max-w-md lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none lg:backdrop-saturate-100',
          ].join(' ')}
        >
          <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Teacher Dashboard
          </p>
          <h2 className="mt-3 text-center text-3xl font-bold tracking-tight text-foreground sm:text-left">
            Sign in
          </h2>
          <p className="mt-3 text-center text-sm leading-relaxed text-muted-foreground sm:text-left">
            Manage your courses and students from one dashboard.
          </p>

          <div className="mt-8">
            <LoginForm action="teacher" redirectTo={ROUTES.TEACHER.dashboard} />
          </div>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider">
              <span className="bg-card px-3 text-muted-foreground">or</span>
            </div>
          </div>

          <GoogleOAuthButton />

          <div className="mt-6 space-y-3 text-center text-sm">
            <p className="text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link
                href={ROUTES.PLATFORM.signup}
                className="font-semibold text-primary hover:text-primary/80"
              >
                Create account
              </Link>
            </p>
            <Link
              href={ROUTES.PLATFORM.login}
              className="block text-xs text-muted-foreground hover:text-foreground"
            >
              Not a teacher? Choose a different role
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
