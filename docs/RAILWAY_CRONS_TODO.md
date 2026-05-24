# Cron jobs after Railway migration — OPEN GAP

Railway has no native cron-job feature. The crons that ran on Vercel
(via `vercel.json`) are NOT currently running on Railway. Several
features silently degrade until this is fixed.

## What needs scheduling

All routes live under `app/api/cron/*` and self-authorize with the
`CRON_SECRET` header (`Authorization: Bearer ${CRON_SECRET}`).

| Route | Schedule (UTC) | Purpose | Severity if missing |
|---|---|---|---|
| `/api/cron/archive-cohorts` | `0 0 * * *` daily 00:00 | Auto-archive cohorts past `end_date` | Medium — cohorts stay editable indefinitely |
| `/api/cron/grace-period` | `0 7 * * *` daily 07:00 | Soft-downgrade expired-grace teachers | High — billing logic breaks |
| `/api/cron/trial-expiry` | `0 6 * * *` daily 06:00 | Auto-downgrade expired trials → free | High — trials never end |
| `/api/cron/renewal-reminders` | `0 8 * * *` daily 08:00 | Email teachers approaching plan expiry | Medium — no warning before downgrade |
| `/api/cron/fee-reminders` | `0 12 * * *` daily 12:00 | Email students with overdue monthly fees | Medium — no fee chasing |
| `/api/cron/class-reminders` | `0 * * * *` hourly | 24h + 1h class reminder emails | High — students miss classes |
| `/api/cron/enrollment-nudge` | `0 14 * * *` daily 14:00 | Email students who never completed payment | Medium — lost enrollments |
| `/api/cron/subscription-nudge` | `0 9 * * *` daily 09:00 | Email teachers with stuck screenshot subs | Medium — pending subs rot |
| `/api/cron/reconcile` | `0 2 * * *` daily 02:00 | Backfill `teacher_balances` from payments | Low — recoverable manually |
| `/api/cron/activity-snapshot` | `5 19 * * *` daily 19:05 UTC (00:05 PKT) | Snapshot teacher WAU/DAU into `teacher_activity_snapshots` | Low — admin dashboard chart works today (live) but no history accrues |

## Options to fix

### Option A: External free cron service (recommended for now)
Set up a free account at https://cron-job.org or https://easycron.com.
For each row above, create a job:
- URL: `https://skoolrooms.site/api/cron/<name>`
- Method: GET
- HTTP header: `Authorization: Bearer <CRON_SECRET value>`
- Schedule: as listed above (most services accept cron syntax directly)

Free tiers handle this easily — total volume is ~30 invocations/day.

### Option B: Railway cron service
Railway supports cron jobs as a separate service in the same project.
Add a new service to the project, use Railway's cron trigger, point it
at the same routes. Cleaner but adds Railway billing (cron services
are billed by execution time, very cheap at this volume).

### Option C: GitHub Actions
Schedule a workflow (`.github/workflows/crons.yml`) that curls each URL.
Free, version-controlled, but adds GitHub as a dependency.

## Until this is fixed

Manually trigger the critical ones (`class-reminders`, `trial-expiry`,
`grace-period`) once a day via:

```
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://skoolrooms.site/api/cron/class-reminders
```

(`CRON_SECRET` from Railway service Variables.)
