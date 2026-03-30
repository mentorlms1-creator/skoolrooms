# Week 5: Cohort Content (Announcements + Attendance + Assignments)

> **For agentic workers:** Use superpowers:subagent-driven-development.

**Goal:** Teacher posts announcements with file attachments, students comment, teacher marks attendance, creates assignments, student submits, teacher reviews. Enrollment revocation and withdrawal flows work.

**Key rules:** Archived cohort write guard on ALL content mutations. Assignment start_date guard. Attendance 24h edit window. Refund deducts teacher_payout_amount_pkr (not full amount). Pinned announcements sorted by pinned_at. Overdue submissions flagged.

## Tasks

1. DB layer: announcements, comments, reads, attendance, assignments, submissions
2. Announcement actions + teacher cohort announcement page
3. Attendance actions + teacher attendance page
4. Assignment + submission actions + pages
5. Enrollment revocation + withdrawal actions
6. Student content pages (announcements view, attendance view)
7. Final integration + review
