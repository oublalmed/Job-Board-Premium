# SKILLINK — Performance Audit (Phase 1)

Light pass (no load testing / profiler run in this phase).

## Positive signals

- **Keyset (cursor) pagination** for CVthèque search (`/search/candidates`) —
  scales better than OFFSET as the pool grows; verified returning `nextCursor`.
- **Indexes present** on hot tables: `job_applications` (3), `candidate_profiles`
  (4), `scores` (3).
- Frontend: Next.js **standalone** build, route-level code splitting, below-the-fold
  sections `dynamic()`-imported on the landing, TanStack Query caching.
- Cron sweeps (cooldown, percentile recalc, retention purge) run off-request via
  BullMQ, keeping request latency clean.

## Observations / risks

| ID | Severity | Item |
|---|---|---|
| PERF-1 | 🟢 LOW | No N+1 analysis run live; recruiter analytics + CVthèque enrichment should be checked with `DB_LOGGING=true` under load. |
| PERF-2 | 🟢 LOW | Admin analytics aggregates run `COUNT`/`GROUP BY` across the (currently polluted) tables; fine at this size, revisit with real volume + covering indexes. |
| PERF-3 | 🟡 MEDIUM (prod-only) | The documented free **Render** deploy sleeps after 15 min → ~30–50 s cold start on first hit. Fine for a demo, not for production SLAs — use a paid always-on instance for prod. |
| PERF-4 | 🟢 LOW | Auth photo on sign-in/up is a ~128 KB external image; ship locally + `next/image` for a self-contained, optimized asset. |

## Not measured (BLOCKED)

- Real page-load / LCP / TTFB numbers (needs Lighthouse/real browser).
- API p95 latency under concurrency (needs k6 — a `k6-search.js` scaffold exists
  in `test/load/`).
- Bundle-size budget audit.
