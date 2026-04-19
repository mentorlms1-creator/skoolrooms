# Lane A — Payouts & Earnings Completion Plan

## Current state (audit)

### Teacher Earnings Page
- `app/(teacher)/dashboard/earnings/page.tsx` — Fully built. Displays: available balance, pending payout, total paid out, outstanding debit (conditional). Renders payout request form + payout history table + recent verified payments list. Uses `formatPKT`, `StatusBadge`, `PageHeader`, `EmptyState` correctly.
- `app/(teacher)/dashboard/earnings/payout-form.tsx` — Fully built. Client Component using `useActionState`. Enforces all three gate conditions (bank details, no active payout, balance >= min). Error and success states rendered. Dark-mode safe.
- `lib/actions/payouts.ts` — `requestPayoutAction` is complete. Validates auth, amount, bank details, active payout guard, balance >= min, calls `createPayoutRequest`. Revalidates `/dashboard/earnings`.
- `lib/db/balances.ts` — Contains: `getTeacherBalance`, `getTeacherPayouts`, `hasActivePayout`, `createPayoutRequest`, `getRecentVerifiedPayments`. The `EarningsPaymentRow` type and all read queries are solid.

### Known Bug in `createPayoutRequest`
`lib/db/balances.ts:134` — The function currently writes `bank_details_snapshot_json` at INSERT time (request time). ARCHITECTURE.md §3 is explicit: "Bank details are read LIVE from `teacher_payment_settings` at admin process time — NOT snapshotted at request time. `bank_details_snapshot_json` is populated only when admin clicks 'Complete' — for audit trail purposes." This must be fixed: INSERT with `bank_details_snapshot_json = null`, snapshot only on admin Complete.

### Admin Payouts Queue
- `app/(platform)/admin/payouts/` — **MISSING entirely.** No page, no layout segment, no server actions.
- `app/api/admin/payouts/` — **MISSING entirely.** No `[id]/complete` or `[id]/fail` route handlers.

### Admin Earnings Panel
- `app/(platform)/admin/earnings/` — **MISSING.** Route `skoolrooms.com/admin/earnings` exists in URL map but has no implementation.

### DB Layer — Payouts
- `lib/db/payouts.ts` — **MISSING.** No dedicated file; payout DB helpers live in `lib/db/balances.ts`. Admin-specific queries (list all payouts, complete, fail, debit panel) are absent.

### Email Templates
- `lib/email/templates/` — Directory does not exist. Templates are inline in `lib/email/sender.ts`. All email types for this lane are **MISSING** implementations: `payout_requested`, `payout_pending_action`, `payout_processed`, `payout_failed`, `refund_debit_recorded`, `refund_debit_recovered`.

### Outstanding Debit Recovery
- `lib/db/` — `credit_teacher_balance()` Postgres RPC function is referenced in ARCHITECTURE.md §3 functions migration (`004_functions.sql`). The function's `deduct_outstanding=true` path (auto-deduct from future credits) must be wired on every `approveMonthlyPaymentAction` / initial payment approval. Current Phase 1 approval code in `lib/actions/enrollment-management.ts` must be checked — it likely does NOT call `deduct_outstanding=true` path.
- No admin UI showing teachers with `outstanding_debit_pkr > 0`.

### Post-Payout Refund ("Record Offline Refund")
- ARCHITECTURE.md §7 describes a "Record Offline Refund" flow for payments already paid out: teacher clicks button, enters amount + note, sets `refunded_at` without touching balance. Current `recordRefundAction` in `lib/actions/enrollment-management.ts` likely only handles in-app refunds. The offline refund path needs verification and possibly its own action.

---

## Gaps vs BUILD_PLAN Phase 2 "Earnings + Payouts"

| Gap | Missing |
|-----|---------|
| Bug: snapshot written at request time, not complete time | `lib/db/balances.ts:createPayoutRequest` |
| Admin payout queue page | `app/(platform)/admin/payouts/page.tsx` |
| Admin payout complete action | `app/api/admin/payouts/[id]/complete/route.ts` |
| Admin payout fail action | `app/api/admin/payouts/[id]/fail/route.ts` |
| Admin earnings panel page | `app/(platform)/admin/earnings/page.tsx` |
| DB helpers for admin payout queries | `lib/db/payouts.ts` (new file) |
| Email: `payout_requested` | `lib/email/sender.ts` (add template branch) |
| Email: `payout_pending_action` | `lib/email/sender.ts` |
| Email: `payout_processed` | `lib/email/sender.ts` |
| Email: `payout_failed` | `lib/email/sender.ts` |
| Email: `refund_debit_recorded` | `lib/email/sender.ts` |
| Email: `refund_debit_recovered` | `lib/email/sender.ts` |
| Offline refund action | `lib/actions/enrollment-management.ts` (verify/add `refund_mode='offline'` path) |
| Outstanding debit auto-recovery in approval flow | `lib/actions/enrollment-management.ts` approveEnrollment + approveMonthlyPaymentAction |
| Admin ops panel: teachers with outstanding debit > 0 | `app/(platform)/admin/operations/page.tsx` (add section) |

---

## Implementation plan (ordered)

### Step 1 — Fix snapshot bug in `createPayoutRequest`
- Files to EDIT: `lib/db/balances.ts`
- Change: INSERT `teacher_payouts` with `bank_details_snapshot_json = null`. Remove the `bankDetailsSnapshot` parameter from `createPayoutRequest`. Update call site in `lib/actions/payouts.ts` (remove snapshot build + param).
- Migration: N/A (column already nullable)
- Testable: Request payout → DB row has `bank_details_snapshot_json = null`. Admin Complete (Step 4) will write the snapshot.

### Step 2 — Add payout emails to `lib/email/sender.ts`
- Files to EDIT: `lib/email/sender.ts`
- Add template branches for: `payout_requested` (to teacher), `payout_pending_action` (to admin), `payout_processed` (to teacher), `payout_failed` (to teacher), `refund_debit_recorded` (to teacher), `refund_debit_recovered` (to teacher).
- Wire `payout_requested` + `payout_pending_action` into `requestPayoutAction` (Step 1 call site in `lib/actions/payouts.ts`).
- Migration: N/A
- Testable: Request payout → teacher receives confirmation email, admin receives action-required email.

### Step 3 — Create `lib/db/payouts.ts` (admin payout query layer)
- Files to CREATE: `lib/db/payouts.ts`
- Functions needed:
  - `getAllPendingPayouts()` — list of `{ payout, teacher, livePaymentSettings }` for admin queue; computes `bankDetailsChanged = settings.updated_at > payout.requested_at`
  - `getPayoutById(payoutId)` — single row with teacher + live bank details
  - `completePayoutDb(payoutId, adminNote, bankSnapshot)` — UPDATE status='completed', processed_at, admin_note, bank_details_snapshot_json; UPDATE teacher_balances pending -= amount, total_paid_out += amount
  - `failPayoutDb(payoutId, adminNote)` — UPDATE status='failed', processed_at, admin_note; UPDATE teacher_balances available += amount, pending -= amount
  - `getTeachersWithOutstandingDebit()` — for admin ops panel, returns teachers where `outstanding_debit_pkr > 0`
  - `getAdminEarningsSummary()` — gross collected (SUM confirmed payments amount_pkr), platform cuts (SUM platform_cut_pkr), payouts processed (SUM completed payouts amount_pkr), net revenue (cuts - operational costs)
- Migration: N/A
- Testable: Unit-testable by calling functions in isolation against DB.

### Step 4 — Admin payout route handlers
- Files to CREATE:
  - `app/api/admin/payouts/[id]/complete/route.ts` — POST, requires admin auth, calls `completePayoutDb`, reads LIVE bank details from `teacher_payment_settings` at this moment (snapshot for audit), sends `payout_processed` email to teacher.
  - `app/api/admin/payouts/[id]/fail/route.ts` — POST, requires admin auth, calls `failPayoutDb`, sends `payout_failed` email to teacher.
- Input for complete: `{ adminNote: string }`
- Input for fail: `{ adminNote: string }`
- Note: These are API routes (not Server Actions) because they are admin-invoked from the admin panel — admin panel is in `(platform)` group which is at `skoolrooms.com`, same domain, so Server Actions would be fine too. **Open question #1:** Should these be Server Actions in the admin page, or API routes? Architecture §5 says mutations use Server Actions unless webhooks/crons — lean toward Server Actions here.
- Migration: N/A
- Testable: POST complete → status='completed', snapshot written, balance updated, teacher emailed. POST fail → status='failed', balance restored, teacher emailed.

### Step 5 — Admin payouts queue page
- Files to CREATE: `app/(platform)/admin/payouts/page.tsx`
- Server Component. Calls `getAllPendingPayouts()`. Renders a table per payout: teacher name, amount, status badge, requested date, LIVE bank details (IBAN / JazzCash / EasyPaisa), warning if `bankDetailsChanged`. Action buttons: "Mark Complete" (opens confirm dialog with admin note input) + "Mark Failed" (same). Reuse `StatusBadge`, `DataTable` or simple table, `ConfirmModal`.
- Also shows completed/failed payouts in a second section (payout history for admin records).
- Files to EDIT: `app/(platform)/admin/layout.tsx` — confirm "Payouts" nav item exists in sidebar (may already be there as a link).
- Migration: N/A
- Testable: Admin visits `/admin/payouts` → sees pending queue → completes one → row moves to history with snapshot.

### Step 6 — Admin earnings panel
- Files to CREATE: `app/(platform)/admin/earnings/page.tsx`
- Server Component. Calls `getAdminEarningsSummary()`. Renders:
  - Gross collected (sum of all confirmed `student_payments.amount_pkr`)
  - Total platform cuts (sum of `platform_cut_pkr`)
  - Total payouts processed (sum of completed `teacher_payouts.amount_pkr`)
  - Net revenue = total platform cuts (screenshot payments — platform cut is collected at payout time, so net = cuts not yet paid out)
  - Teachers with outstanding debit > 0 (from `getTeachersWithOutstandingDebit()`) with a small table showing teacher name + debit amount
- Note: BUILD_PLAN says "gross collected, platform cuts, payouts processed, net revenue." This is the minimum viable panel.
- Migration: N/A
- Testable: Admin visits `/admin/earnings` → sees 4 stat cards + debit table.

### Step 7 — Verify offline refund path + outstanding debit auto-recovery
- Files to EDIT: `lib/actions/enrollment-management.ts`
- Sub-task A — Offline refund: Verify `recordRefundAction` handles `refund_mode='offline'` path. Per ARCHITECTURE.md §7: offline = set `refunded_at = now()`, save `refund_note`, do NOT touch `teacher_balances`. If missing, add the path. Send `refund_recorded` email to admin for records.
- Sub-task B — Outstanding debit recovery: Verify that `credit_teacher_balance()` Postgres RPC is called with `deduct_outstanding = true` in both initial enrollment approval and monthly payment approval. If the current code does a raw balance update instead of calling the RPC with this flag, fix it. The RPC auto-deducts outstanding debit from the credit before crediting teacher. When `outstanding_debit_pkr` reaches 0, send `refund_debit_recovered` email.
- Migration: N/A (RPC already exists in `004_functions.sql`)
- Testable: Teacher has `outstanding_debit_pkr = 3000`, next student payment of 5000 approved → balance credited 2000 (5000 - 3000), debit becomes 0 → `refund_debit_recovered` email sent.

### Step 8 — Admin operations panel: outstanding debit section
- Files to EDIT: `app/(platform)/admin/operations/page.tsx`
- Add a section "Outstanding Debits" listing teachers with `outstanding_debit_pkr > 0`. Show: teacher name, debit amount, a "Clear Debit" action (admin manually forgives — sets `outstanding_debit_pkr = 0`, logs to `admin_activity_log`).
- Files to CREATE: `app/api/admin/teachers/[id]/clear-debit/route.ts` (or Server Action inline in ops page — prefer Server Action per architecture rules).
- Migration: N/A
- Testable: Teacher with debit appears in list. Admin clears → debit = 0, no longer shown.

---

## Execution order summary

```
Step 1 (bug fix, unblocks correct behavior)
  → Step 2 (emails, wired after Step 1 fixes requestPayoutAction)
  → Step 3 (DB layer, required by Steps 4, 5, 6)
    → Step 4 (API/actions, requires Step 3 + Step 2)
    → Step 5 (admin UI, requires Steps 3 + 4)
    → Step 6 (admin earnings, requires Step 3)
  → Step 7 (offline refund + debit recovery — independent of Steps 3–6, can run in parallel)
  → Step 8 (ops panel debit section — requires Step 7's debit recovery to be correct)
```

---

## Shared code this lane touches (coordination)

- **Do NOT touch:** `components/ui/*`, teacher dashboard layout, student layout, existing migrations 001–009.
- **Reads (no edit):** `lib/db/admin.ts` (for `getTeacherPaymentSettings`), `lib/platform/settings.ts` (for `getMinPayoutAmount`), `lib/auth/guards.ts` (for `requireAdmin`, `requireTeacher`), `lib/time/pkt.ts` (for `formatPKT`).
- **Edit existing:** `lib/db/balances.ts` (Step 1 snapshot bug), `lib/email/sender.ts` (Step 2 templates), `lib/actions/payouts.ts` (Step 1 + 2 wiring), `lib/actions/enrollment-management.ts` (Step 7), `app/(platform)/admin/operations/page.tsx` (Step 8), `app/(platform)/admin/layout.tsx` (confirm Payouts nav link).
- **Create new:** `lib/db/payouts.ts`, `app/(platform)/admin/payouts/page.tsx`, `app/(platform)/admin/earnings/page.tsx`, `app/api/admin/payouts/[id]/complete/route.ts`, `app/api/admin/payouts/[id]/fail/route.ts` (or replace with Server Actions — see Open Question #1).

---

## Open questions for team-lead

1. **Server Actions vs API routes for admin payout complete/fail:** Architecture rules say mutations use Server Actions, not API routes. But the admin panel pages are Server Components in `app/(platform)/admin/`. Should `completePayoutAction` and `failPayoutAction` be Server Actions defined in the admin payouts page file (or a co-located `actions.ts`), rather than API routes? Recommend: Server Actions — consistent with rest of codebase.

2. **`credit_teacher_balance()` signature:** The Postgres RPC in `004_functions.sql` is referenced as `credit_teacher_balance(teacherId, teacher_payout_amount_pkr, deduct_outstanding=true)`. The current Phase 1 approval code may be doing a raw UPDATE instead of calling this RPC. Need to confirm: does the current `approveEnrollment` call the RPC, or does it do a raw balance increment? If raw, Step 7 becomes a more significant refactor — flag before building.

3. **Admin nav "Payouts" link:** The admin sidebar in `app/(platform)/admin/layout.tsx` likely already lists Payouts as a nav item (it's in the URL map). Confirm this is wired to `/admin/payouts` before building the page, to avoid sidebar duplication.

4. **`refund_debit_recorded` trigger:** Per ARCHITECTURE.md, this email fires when "platform absorbs refund" — a gateway chargeback scenario. The gateway is not yet live (Phase 2 prerequisite). Is the `outstanding_debit_pkr` increment + `refund_debit_recorded` email needed now, or only when the gateway adapter is built? If the admin can manually set `outstanding_debit_pkr` via a future admin action, this email trigger may be deferred. Recommend: build the email template now, defer the trigger to gateway build.

---

## Answers from team-lead

1. **Server Actions, not API routes.** Define `completePayoutAction` and `failPayoutAction` in a co-located `lib/actions/admin-payouts.ts` (new file). Call them from the admin payouts page. Consistent with rest of codebase.

2. **`credit_teacher_balance` RPC with `p_deduct_outstanding: true` is already wired** in `lib/actions/student-payments.ts:78-82` (see `confirmPaymentAndCreditBalance`). No refactor needed for Step 7B's approval-side plumbing. Scope of Step 7B is narrowed to: after the RPC call, detect if the credit caused `outstanding_debit_pkr` to hit 0 (read balance row before + after, or have the RPC return the new value), and in that case send `refund_debit_recovered` email. If the RPC does not currently return the post-credit debit value, take the simpler route: re-read `teacher_balances.outstanding_debit_pkr` after the RPC call; if it equals 0 AND the pre-RPC value was > 0, fire the email.

3. **Admin "Payouts" nav link is NOT wired** in `app/(platform)/admin/layout.tsx`. Step 5 must add it to the sidebar before building the page.

4. **Defer `refund_debit_recorded` trigger to gateway build.** BUILD the email template now (Step 2) so the type exists in the EmailType enum, but do NOT wire a call-site. Add a `// TODO(phase2-gateway): fire refund_debit_recorded when platform absorbs refund via chargeback` comment near the webhook stub if one exists.

## Migration numbering
- Lane A needs NO migration. All changes are code-only.
- Migration 010 reserved for Lane B (messaging + notifications).
- Migration 011 reserved for Lane D if needed.
