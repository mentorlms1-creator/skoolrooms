# Marketing Site Redesign — Plan

Status: **on hold**. Resume after the teacher dashboard is visually polished enough to be the hero visual on the landing page. The marketing redesign depends on real product screenshots; without them, premium positioning falls flat.

## Direction

Apple-inspired *restraint*, not an Apple clone. The marketing site should feel calm, confident, and premium — the kind of surface a non-technical Pakistani tutor lands on and immediately trusts.

Steal from Apple:
- One bold headline + one supporting line + two CTAs in the hero. No feature grid above the fold.
- Full-bleed feature sections that each tell a single story with a single visual (real product screenshot, not illustration).
- Frosted sticky nav, generous whitespace, 24–32px radii, soft shadows, near-white surfaces (`#FFFFFF` / `#F5F5F7`).
- Subtle, purposeful motion (fade-in on scroll, gentle hover lift). No parallax device mockups.
- Microcopy discipline: one idea per section, no jargon. Tighten 40%, don't compress 90%.

Reject:
- **Don't swap purple for Apple blue.** Purple is the brand — keep it, use it sparingly as a single accent on mostly white surfaces.
- **Don't go full Apple-terse on copy.** SkoolRooms is unknown and the audience needs *some* explanation. Confident, not cryptic.
- **No SF Pro.** Apple's license restricts commercial web use, and it telegraphs imitation. Use Inter or pay for a more distinctive face (GT America, Söhne).
- **No heavy 3D device mockups or parallax.** Pakistani mobile connections — static high-quality screenshots + one tasteful scroll reveal gets ~90% of the feel at ~10% of the LCP cost.

## Prototyping Approach (when we resume)

Build one section at a time, in this order, and only move on once the previous one feels right with real content:

1. **Hero** — headline, supporting line, two CTAs, one dashboard screenshot framed with rounded corners + soft shadow. No mockup, no parallax.
2. **First feature section** — "Build engaging courses." Single screenshot of the cohort/course management view, headline, one-line supporting copy.
3. Repeat the feature-section pattern for: Scheduling, Payments, Branding.
4. Ecosystem strip (monochrome logos: Google Meet, JazzCash, EasyPaisa, etc.).
5. Pricing.
6. Final CTA.

## Assets Needed Before We Start

- Desktop screenshot (1440px+, light mode) of the polished teacher dashboard — realistic data, no devtools, no scrollbars.
- Desktop screenshot of the polished cohort/course management view.
- Eventually: scheduling view, payments view, public teacher subdomain page.

If any view isn't visually strong enough to show, fix that view first. The marketing site cannot lead with screenshots that look unfinished.

## Open Questions to Resolve Before Resuming

- Secondary CTA — replace "Find a Teacher" (serves students, not the visitor we're converting) with "See pricing" or "Watch demo"? Decide before the hero is built.
- Body font — stick with Inter, or invest in a more distinctive paid face?
- Headline copy — "Teach beautifully." is strong but generic. Consider an alternative that nods to the Pakistani educator context without being on-the-nose.

## Scope Boundary

This plan covers the **marketing site only** (skoolrooms.com landing, pricing, explore, teacher subdomains). Applying Apple-style aesthetics to the in-product dashboard is a separate, larger effort — Apple's own pro apps (Logic, Final Cut) aren't minimal, and "interface fades into the background" can mean "non-technical teachers can't find anything." Don't conflate the two.
