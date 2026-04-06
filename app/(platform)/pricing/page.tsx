/**
 * app/(platform)/pricing/page.tsx — Pricing page
 * Server Component. Displays Free / Solo / Academy plan cards.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { PublicNavbar } from '@/components/public/PublicNavbar'

export const metadata: Metadata = {
  title: 'Pricing — Lumscribe',
  description: 'Simple, transparent pricing for Lumscribe. Start free, upgrade when you grow.',
}

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-background">
      {/* ── Header ── */}
      <PublicNavbar />

      <main>
      {/* ── Pricing section ── */}
      <section className="mx-auto max-w-5xl px-4 py-20">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Start free. Upgrade when you grow. No hidden fees.
          </p>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col p-6 ${
                plan.featured ? 'ring-2 ring-primary' : ''
              }`}
            >
              {/* Most Popular badge */}
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                  Most Popular
                </span>
              )}

              {/* Plan name */}
              <h2 className="text-xl font-bold text-foreground">{plan.name}</h2>

              {/* Price */}
              <div className="mt-4">
                <span className="text-3xl font-bold text-foreground">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                )}
              </div>

              {/* Trial note */}
              {plan.trial && (
                <p className="mt-1 text-sm text-primary font-medium">
                  {plan.trial}
                </p>
              )}

              {/* Features */}
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckIcon />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="mt-8">
                <Link
                  href={ROUTES.PLATFORM.signup}
                  className={`block w-full rounded-md px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                    plan.featured
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'border border-primary text-primary hover:bg-primary/10'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-background py-8 text-center text-sm text-muted-foreground">
        Lumscribe &mdash; LMS for Tutors
      </footer>
    </div>
  )
}

// ── Checkmark icon ──

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="mt-0.5 h-4 w-4 shrink-0 text-success"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}

// ── Plan data ──

type Plan = {
  name: string
  price: string
  period: string | null
  trial: string | null
  featured: boolean
  features: string[]
  cta: string
}

const PLANS: Plan[] = [
  {
    name: 'Free',
    price: 'Rs. 0',
    period: null,
    trial: null,
    featured: false,
    features: [
      '1 course',
      '15 students',
      '1 cohort',
      '500 MB storage',
      'Branded subdomain',
      'Screenshot payments',
    ],
    cta: 'Get Started',
  },
  {
    name: 'Solo',
    price: 'Rs. 1,999',
    period: '/mo',
    trial: '14-day free trial',
    featured: true,
    features: [
      '5 courses',
      '50 students',
      'Unlimited cohorts',
      '2 GB storage',
      'Analytics dashboard',
      'Branded subdomain',
      'Screenshot payments',
    ],
    cta: 'Start Free Trial',
  },
  {
    name: 'Academy',
    price: 'Rs. 3,999',
    period: '/mo',
    trial: '14-day free trial',
    featured: false,
    features: [
      'Unlimited courses',
      '200 students',
      'Unlimited cohorts',
      '10 GB storage',
      'Multi-teacher support',
      'WhatsApp notifications',
      'Analytics dashboard',
      'Branded subdomain',
      'Screenshot payments',
    ],
    cta: 'Start Free Trial',
  },
]
