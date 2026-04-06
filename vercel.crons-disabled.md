# Disabled Crons — Upgrade to Vercel Pro to enable

Move these back into `vercel.json` `crons` array when upgraded:

```json
{ "path": "/api/cron/trial-expiry", "schedule": "0 6 * * *" },
{ "path": "/api/cron/renewal-reminders", "schedule": "0 8 * * *" },
{ "path": "/api/cron/fee-reminders", "schedule": "0 12 * * *" },
{ "path": "/api/cron/class-reminders", "schedule": "0 * * * *" },
{ "path": "/api/cron/enrollment-nudge", "schedule": "0 14 * * *" },
{ "path": "/api/cron/subscription-nudge", "schedule": "0 9 * * *" },
{ "path": "/api/cron/reconcile", "schedule": "0 2 * * *" }
```
