# v2 Tech Debt — Known Gaps

Things we deliberately deferred during v1 implementation. Each entry includes
the why so the v2 author can decide whether the trade-off still holds.

---

## Soft-downgrade: paid features hide existing data

**Status:** open since 2026-05-10 (soft-downgrade flow shipped — see commit
`a38b55b`).

**Symptom.** When a Solo/Academy teacher is soft-downgraded to Free, paid
features they relied on disappear immediately — including features that
*display* historical data, not just create new things. Most painful:

| Feature | Free? | What disappears on downgrade |
|---|---|---|
| `cohort_archive_history` | ❌ | Existing archived cohorts become invisible to the teacher |
| `analytics_dashboard` | ❌ | Cohort/revenue analytics views go blank |
| `revenue_analytics` | ❌ | 6-month revenue chart, projections |
| `student_health_signals` | ❌ | At-risk / disengaged tabs empty |
| `progress_report_pdf` | ❌ | PDF download button disabled per student |

This contradicts the soft-downgrade principle ("grandfather over-limit data,
block creation"). Slack/Notion handle this by grandfathering view access to
data created during a paid period — only NEW writes are gated by the current
plan. We didn't replicate that.

**Why deferred.** Touching `canUseFeature` to grandfather paid features for
"data created while the teacher was paid" is broader than soft-downgrade. It
needs:

1. A signal on each piece of historical data ("created under plan X") — the
   `teacher_plan_snapshot` table is close but is per-teacher, not per-record.
2. A decision per feature: which features grandfather (view-only access to
   legacy items) and which fully gate (e.g. "discount codes" probably shouldn't
   grandfather — student-facing impact).
3. UI to explain to the teacher: "Analytics for cohorts that ran while you were
   on Solo are still visible, but new cohorts won't appear here until you
   renew."

**Acceptable v1 behaviour.** Strict cut. Soft-downgraded teachers see the
empty state for paid features. Renewal restores everything.

**v2 fix sketch.**
1. Add `feature_data_grandfathered` JSONB column to `teachers` (or piggyback on
   `teacher_plan_snapshot.snapshot_json.grandfathered_features`).
2. Snapshot the feature set when a paid plan starts; never clear it on
   downgrade — only on a NEW paid plan start.
3. `canUseFeature` becomes 3-way: `denied | granted | granted_for_legacy`.
4. Feature pages branch: when `granted_for_legacy`, show only items created
   before `downgraded_at`.

**Out of scope until:** soft-downgrade actually causes churn complaints from
real users. Track in user feedback under tag `paid-features-hidden`.
