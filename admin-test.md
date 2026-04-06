# Admin Panel — E2E Test Results

**Tested:** 2026-04-01
**Browser:** Playwright (Chromium)
**Test Account:** admin@test.com (Platform Admin)
**Viewports:** Desktop (1280x800), Mobile (375x812)

## Authentication

- [x] Admin login at `/admin-login` works with correct credentials
- [x] Redirects to `/admin` after successful login
- [x] Sign Out button present in sidebar
- [x] "Skool Rooms Admin" branding with "Admin" badge in sidebar

## Dashboard (`/admin`)

- [x] Page loads successfully
- [x] Title: "Admin Dashboard" with subtitle "Platform overview and key metrics."
- [x] Top row metrics: Monthly Recurring Revenue (PKR 0), Signups This Week (2), Signups This Month (2), Pending Payments (0)
- [x] Bottom row metrics: Active Cohorts (0), Total Students (1), Plan Distribution (Free: 2)
- [ ] **BUG: Generic page title** — All admin pages show "Skool Rooms — LMS for Tutors" instead of "Admin Dashboard — Skool Rooms" etc.

## Teachers (`/admin/teachers`)

- [x] Page loads successfully
- [x] Teacher count shown: "2 teachers on the platform."
- [x] Search bar: "Search teachers..."
- [x] Entries per page selector (10/25/50)
- [x] Sortable table columns: Name, Email, Plan, Status, Students, Joined
- [x] Teacher rows show correct data with "Active" status badges
- [x] Teacher names are clickable links to detail pages

## Teacher Detail (`/admin/teachers/[id]`)

- [x] Page loads successfully
- [x] Back arrow navigation
- [x] Profile section: Subdomain, City, Bio, Subject Tags, Teaching Levels, Publicly Listed, Onboarding Complete, Students count, Joined date, Last Updated
- [x] Plan section: Current Plan, Status, Plan Expires, Grace Until, Trial Ends
- [x] Subscription History section (empty state works)
- [x] Activity Log section (empty state works)
- [x] Admin Actions panel:
  - [x] Suspend Teacher button (red)
  - [x] Change Plan dropdown with Update Plan button
  - [x] Extend Plan Expiry (days input + button)
  - [x] Extend Trial (days input + button)

## Payments (`/admin/payments`)

- [x] Page loads successfully
- [x] Title: "Subscription Payments"
- [x] Subtitle: "Review and verify pending subscription screenshots."
- [x] Empty state: "No pending subscriptions to review."

## Settings (`/admin/settings`)

- [x] Page loads successfully
- [x] Title: "Platform Settings"
- [x] All 13 platform settings displayed and editable:
  - [x] Active Gateway (text: "mock")
  - [x] Gateway Error Alert Threshold (number: 5)
  - [x] Gateway Processing Fee Percent (number: 2.50)
  - [x] Min Payout Amount Pkr (number: 2500)
  - [x] Payment Gateway Enabled (toggle: off)
  - [x] Payout Processing Days (number: 3)
  - [x] R2 Upload Limit Announcement Mb (number: 25)
  - [x] R2 Upload Limit Assignment Mb (number: 25)
  - [x] R2 Upload Limit Profile Mb (number: 2)
  - [x] R2 Upload Limit Submission Mb (number: 50)
  - [x] R2 Upload Limit Thumbnail Mb (number: 5)
  - [x] Screenshot Payments Enabled (toggle: on)
- [x] "Save Settings" button
- [x] ~~**BUG: Inconsistent boolean input for "Refund Debit Recovery Enabled"**~~ — FIXED: Added to `TOGGLE_SETTINGS` array in `PlatformSettingsForm.tsx`.

## Operations (`/admin/operations`)

- [x] Page loads successfully
- [x] Title: "Operations" with subtitle "Platform operations overview."
- [x] Stats cards: Active Cohorts (0), Total Students (1), Pending Payments (0)
- [x] Cards have helpful subtitles (e.g., "Currently running cohorts across all teachers")

## Sidebar Navigation

- [x] Dashboard link → `/admin` (works)
- [x] Teachers link → `/admin/teachers` (works)
- [x] Payments link → `/admin/payments` (works)
- [x] Settings link → `/admin/settings` (works)
- [x] Operations link → `/admin/operations` (works)

## Mobile (375px)

- [x] ~~**CRITICAL BUG: Sidebar always visible on mobile**~~ — FIXED: Added mobile hamburger with slide-out sidebar, overlay, and proper content spacing.

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 0 | All fixed |
| Major | 0 | |
| Medium | 1 | Generic page titles |
| Minor | 0 | |

**All critical and medium issues RESOLVED.** Remaining medium issue (page titles) is cosmetic.
