# Week 4: Student Enrollment + Screenshot Payments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement.

**Goal:** Full enrollment flow: student finds cohort via invite link, registers/logs in, uploads payment screenshot, teacher approves, student gets access to portal with classes and Meet links.

**Architecture:** Server Actions for mutations. API routes only for: public payment-info endpoint (read-only, no auth), enrollment endpoint (uses Postgres function). DB queries in lib/db/. Platform cut calculated and stored at payment time (never re-derived). All money integers in PKR.

**Key business rules:**
- Screenshots go to teacher's bank directly. Platform credits teacher_balances with net amount (after cut).
- Manual "Mark as Paid" sets platform_cut_pkr=0, balance NOT credited.
- Reference codes: 6 chars from safe charset (no 0/O/1/I/L), displayed as REF-XXXXXX.
- enroll_student_atomic() uses SELECT FOR UPDATE for slot locking.
- credit_teacher_balance() atomically credits balance with outstanding debit deduction.

---

## Tasks

### Task 1: DB service layer (enrollments, student_payments, students)
- Create: lib/db/enrollments.ts, lib/db/student-payments.ts, lib/db/students.ts
- Reference code generation utility
- Functions: createEnrollment, getEnrollmentById, updateEnrollmentStatus, getPendingPayments, createPayment, approvePayment, rejectPayment, getStudentByEmail, etc.

### Task 2: Enrollment + payment server actions
- Create: lib/actions/enrollments.ts
- Actions: enrollStudentAction, approveEnrollmentAction, rejectEnrollmentAction, manualEnrollAction, createAndEnrollAction
- Platform cut calculation at approval time
- credit_teacher_balance() call via Supabase RPC
- Ownership verification, archived guard

### Task 3: Payment info API route + enrollment API route
- Create: app/api/public/cohort/[token]/payment-info/route.ts (GET, no auth)
- Create: app/api/student/enroll/route.ts (POST, student auth, calls enroll_student_atomic)

### Task 4: Payment page + screenshot upload
- Create: app/(teacher-public)/[subdomain]/join/[token]/pay/[enrollmentId]/page.tsx
- Shows teacher bank details, QR code, reference code, screenshot upload

### Task 5: Teacher payment verification panel
- Create: app/(teacher)/dashboard/payments/page.tsx
- Pending payments list, full-size screenshot view, approve/reject buttons

### Task 6: Student portal layout + pages
- Create: app/(student)/layout.tsx (auth guard + StudentProvider)
- Create: app/(student)/page.tsx (dashboard)
- Create: app/(student)/courses/page.tsx
- Create: app/(student)/schedule/page.tsx
- Create: app/(student)/billing/page.tsx
- Create: app/(student)/settings/page.tsx
- Top nav component

### Task 7: Integration + verification
- TypeScript check, dev server test, final commit
