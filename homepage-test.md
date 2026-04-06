# Homepage & Public Pages — E2E Test Results

**Tested:** 2026-04-01
**Browser:** Playwright (Chromium)
**Viewports:** Desktop (1280x800), Mobile (375x812)

## Homepage (`/`)

### Desktop
- [x] Page loads successfully
- [x] Title is "Skool Rooms — LMS for Tutors"
- [x] Hero section displays correctly with heading, description, and CTAs
- [x] "Start Free" and "Find a Teacher" buttons link to correct routes
- [x] Feature cards (Branded Subdomain, Course Management, Simple Payments) render correctly
- [x] Navbar shows: Skool Rooms logo, Find a Teacher, Pricing, Log In, Start Free
- [x] Footer displays correctly
- [x] ~~**BUG: Missing favicon**~~ — FIXED: Added `app/icon.svg`

### Mobile (375px)
- [x] ~~**BUG: No hamburger menu**~~ — FIXED: Created `PublicNavbar` component with hamburger menu for mobile
- [ ] **NOTE: Next.js Dev Tools "N" button overlaps content** — Dev-only, not a production issue

## Explore Page (`/explore`)

- [x] Page loads successfully
- [x] Title is "Explore Teachers — Skool Rooms"
- [x] Filter bar shows Subject, Level, Max Fee, and Open Cohorts checkbox
- [x] Empty state shows "No teachers found" with helpful message
- [x] ~~**MISSING: No navbar**~~ — FIXED: Added `PublicNavbar` to explore page

## Pricing Page (`/pricing`)

- [x] Page loads successfully
- [x] Three plan cards displayed: Free (Rs. 0), Solo (Rs. 1,999/mo), Academy (Rs. 3,999/mo)
- [x] Feature lists are accurate per plan
- [x] "Most Popular" badge on Solo plan
- [x] CTA buttons: Get Started (Free), Start Free Trial (Solo/Academy)
- [x] ~~**BUG: Incomplete navbar**~~ — FIXED: Replaced with shared `PublicNavbar` component
- [x] ~~**BUG: Generic page title**~~ — FIXED: Added metadata export with "Pricing — Skool Rooms"

## Login Page (`/login`)

- [x] Page loads successfully
- [x] Title is "Sign in — Skool Rooms"
- [x] Email and password fields with proper placeholders
- [x] "Forgot password?" link → `/forgot-password`
- [x] "Create account" link → `/signup`
- [x] "Sign in as a student instead" link → `/student-login`
- [x] Successful login redirects to `/dashboard`

## Signup Page (`/signup`)

- [x] Page loads successfully
- [x] Title is "Create account — Skool Rooms"
- [x] Full name, email, password, confirm password fields
- [x] Successful signup shows "Check your email" verification screen
- [x] "Already have an account? Sign in" link works

## Student Login Page (`/student-login`)

- [x] Page loads successfully
- [x] Title is "Student Sign in — Skool Rooms"
- [x] "STUDENT PORTAL" label distinguishes from teacher login
- [x] ~~**BUG: Duplicate "Forgot password?" links**~~ — FIXED: Removed duplicate link from page, kept the one in LoginForm
- [x] "Sign in as a teacher instead" link works
- [x] Successful login redirects to `/student`

## Forgot Password Page (`/forgot-password`)

- [x] Page loads successfully
- [x] Title is "Forgot password — Skool Rooms"
- [x] Email field with "Send reset link" button
- [x] "Back to sign in" link works

## Admin Login Page (`/admin-login`)

- [x] Page loads successfully
- [x] Title is "Admin Login — Skool Rooms"
- [x] "Skool Rooms Admin" heading clearly identifies as admin login
- [x] Email and password fields
- [x] Successful login redirects to `/admin`

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 0 | |
| Major | 0 | All fixed |
| Medium | 0 | All fixed |
| Minor | 1 | Next.js Dev Tools overlay (dev-only, not a production issue) |

**All homepage issues RESOLVED.** Fixes applied: shared `PublicNavbar` with hamburger menu, favicon SVG, pricing metadata, explore navbar, duplicate link removal.
