// =============================================================================
// app/(teacher)/onboarding/layout.tsx — Onboarding wizard layout
// Minimal layout with NO sidebar — just centered content with brand heading.
// =============================================================================

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-xl px-4 py-12">
        {/* Brand heading */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary">Lumscribe</h1>
          <p className="mt-2 text-muted-foreground">Set up your teaching profile</p>
        </div>

        {children}
      </div>
    </div>
  )
}
