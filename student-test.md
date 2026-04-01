# Student Portal — E2E Test Results

**Tested:** 2026-04-01
**Browser:** Playwright (Chromium)
**Test Account:** student@test.com (Sara Ali)
**Viewports:** Desktop (1280x800), Mobile (375x812)

## Authentication

- [x] Student login at `/student-login` works with correct credentials
- [x] Redirects to `/student` after successful login
- [x] Sign Out button present in top nav bar

## Dashboard (`/student`)

- [x] Page loads successfully
- [x] Welcome message: "Welcome back, Sara"
- [x] Subtitle: "Here are your upcoming classes"
- [x] Stats cards: Active Courses (0), Upcoming Classes (0)
- [x] Quick Links card: My Courses, Full Schedule
- [x] Empty state: "No upcoming classes" with "View My Courses" CTA
- [ ] **BUG: Generic page title** — All student pages show "Lumscribe — LMS for Tutors" instead of specific titles like "Dashboard — Lumscribe Student", "My Courses — Lumscribe", etc.

## My Courses (`/student/courses`)

- [x] Page loads successfully
- [x] Title: "My Courses" with subtitle "All courses you are enrolled in"
- [x] Empty state: "No courses yet — Ask your teacher for an invite link to get started."

## Schedule (`/student/schedule`)

- [x] Page loads successfully
- [x] Title: "Schedule" with subtitle "All your upcoming classes across all courses"
- [x] Empty state: "No upcoming classes — Your teachers will add classes to your enrolled courses."

## Payments (`/student/payments`)

- [x] Page loads successfully
- [x] Title: "Payments" with subtitle "Your payment history and pending fees"
- [x] Empty state: "No payment records — Your payment history will appear here once you make your first payment."

## Settings (`/student/settings`)

- [x] Page loads successfully
- [x] Title: "Settings" with subtitle "Manage your profile information"
- [x] Editable fields: Full Name, Phone
- [x] Read-only fields: Email (with "Email cannot be changed here." note)
- [x] Member Since date displayed (30 Mar 2026)
- [x] "Save Changes" button

## Navigation

- [x] Horizontal top navbar (different from teacher sidebar — good UX choice)
- [x] Dashboard link → `/student` (works)
- [x] My Courses link → `/student/courses` (works)
- [x] Schedule link → `/student/schedule` (works)
- [x] Payments link → `/student/payments` (works)
- [x] Settings link → `/student/settings` (works)
- [x] Sign Out button (works)

## Mobile (375px)

- [x] ~~**BUG: Nav items overflow on mobile**~~ — FIXED: Added hamburger menu for mobile with dropdown nav items.
- [x] Content area renders full width (no sidebar blocking issue like teacher/admin)
- [x] Cards stack vertically properly

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 0 | |
| Major | 0 | All fixed |
| Medium | 1 | Generic page titles on all student pages |
| Minor | 0 | |

**All major issues RESOLVED.** Remaining medium issue (page titles) is cosmetic.
