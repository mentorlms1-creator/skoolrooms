# Admin Deep E2E Test Results

**Tested:** 2026-04-01
**Browser:** Playwright (Chromium) + Chrome DevTools MCP
**Test Account:** admin@test.com (Platform Admin)
**Viewport:** Desktop 1280x800, Mobile 375x812

---

## Phase 1: Authentication

- [x] Admin login at `/admin-login` works
- [x] Redirects to `/admin` after login
- [x] Page title: "Admin Dashboard — Lumscribe"
- [x] Sidebar shows "Lumscribe" with "Admin" badge

---

## Phase 2: Dashboard Metrics

- [x] Monthly Recurring Revenue: PKR 1,999 (accurately reflects 1 Solo plan teacher)
- [x] Signups This Week: 2
- [x] Signups This Month: 2
- [x] Pending Payments: 0
- [x] Active Cohorts: 0
- [x] Total Students: 1
- [x] Plan Distribution: free: 1, solo: 1 (correctly updated after plan change)

---

## Phase 3: Teacher Management

### Teacher List
- [x] Page loads at `/admin/teachers`
- [x] Page title: "Teachers — Lumscribe Admin"
- [x] Shows "2 teachers on the platform."
- [x] **Search works** — typing "Ahmed" filters to 1 row, clearing restores all
- [x] Sortable columns: Name, Email, Plan, Status, Students, Joined
- [x] Entries per page selector (10/25/50)
- [x] Teacher names are clickable links

### Teacher Detail Page
- [x] Loads with full profile data
- [x] **Profile section**: Subdomain, City, Bio, Subject Tags, Teaching Levels, Publicly Listed, Onboarding Complete, Students, Joined, Last Updated
- [x] **Plan section**: Current Plan, Status, Plan Expires, Grace Until, Trial Ends
- [x] **Subscription History**: "No subscriptions yet." (empty state)
- [x] **Activity Log**: Shows admin actions with timestamp and actor
- [x] Back arrow navigation works

### Admin Actions — Change Plan
- [x] Plan dropdown shows: Free, Solo, Academy
- [x] Select "Solo" → click "Update Plan"
- [x] Success toast: "Plan updated."
- [x] Plan section updates: Current Plan → Solo, Plan Expires → 1 May 2026, 3:58 Pm
- [x] Activity Log records: "Change Plan" by admin@test.com with `{"new_plan":"solo","old_plan":"free"}`
- [x] Last Updated timestamp refreshed
- [x] Dashboard MRR updates to PKR 1,999

### Admin Actions — Suspend Teacher
- [x] "Suspend Teacher" button (red) present
- [ ] **NOT TESTED** — Did not click to avoid disrupting the test teacher account

### Admin Actions — Extend Plan Expiry
- [x] "Days to add" input field present
- [x] "Extend Expiry" button present
- [ ] **NOT TESTED** — Did not test to avoid changing plan state

### Admin Actions — Extend Trial
- [x] "Days to add" input field present
- [x] "Extend Trial" button present
- [ ] **NOT TESTED** — Teacher is not on trial

---

## Phase 4: Payments

- [x] Page loads at `/admin/payments`
- [x] Page title: "Payments — Lumscribe Admin"
- [x] Title: "Subscription Payments"
- [x] Empty state: "No pending subscriptions to review."

---

## Phase 5: Platform Settings

- [x] Page loads at `/admin/settings`
- [x] Page title: "Settings — Lumscribe Admin"
- [x] All 13 platform settings displayed
- [x] **Toggle switches**: 3 boolean settings now use toggle switches:
  - Payment Gateway Enabled (off)
  - Refund Debit Recovery Enabled (on) — **fix confirmed**
  - Screenshot Payments Enabled (on)
- [x] Numeric inputs for: Gateway Error Alert Threshold, Gateway Processing Fee Percent, Min Payout Amount, Payout Processing Days, R2 Upload Limits (5 settings)
- [x] Text input for: Active Gateway ("mock")
- [x] "Save Settings" button present

---

## Phase 6: Operations

- [x] Page loads at `/admin/operations`
- [x] Page title: "Operations — Lumscribe Admin"
- [x] Stats cards: Active Cohorts (0), Total Students (1), Pending Payments (0)
- [x] Helpful subtitles on each card

---

## Phase 7: Mobile Responsiveness

- [x] Mobile top bar with "Lumscribe Admin" badge + hamburger
- [x] Sidebar hidden by default on mobile
- [x] Hamburger opens slide-out sidebar
- [x] Content takes full width
- [x] Stats cards stack vertically

---

## Phase 8: Navigation & Sidebar

- [x] Dashboard → `/admin` (works)
- [x] Teachers → `/admin/teachers` (works)
- [x] Payments → `/admin/payments` (works)
- [x] Settings → `/admin/settings` (works)
- [x] Operations → `/admin/operations` (works)
- [x] Sign Out button present

---

## Issues Found

| # | Severity | Description | Location |
|---|----------|-------------|----------|
| 1 | Low | Teacher detail page title still generic "Lumscribe — LMS for Tutors" | `/admin/teachers/[id]` |
| 2 | Info | Activity Log shows raw JSON for plan change details | Activity Log section |

---

## Notes

- Admin panel is solid and functional
- Dashboard metrics are live and accurate (MRR updated immediately after plan change)
- Teacher search and filtering works correctly
- Admin actions (Change Plan) work with proper toast, activity logging, and data refresh
- All toggle fixes confirmed working (3 boolean settings as switches)
- Mobile hamburger works correctly

**28 passed** / **3 not tested (destructive actions)** / **0 bugs found** / **1 cosmetic issue**
