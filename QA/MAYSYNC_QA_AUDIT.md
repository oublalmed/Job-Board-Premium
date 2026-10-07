# SKILLINK — QA Audit Report (Phase 1 — Audit only, no code changes)

**Date:** 2026-10-06 · **Method:** live testing against the running stack
(API `:3000`, frontend `:3001`, PostgreSQL) + automated suites + DB inspection +
targeted code review. No source files were modified during this phase.

> This report is the index. Details are split into the companion files listed in
> §11.

---

## 1. Executive Summary

MaySync is a **well-architected, genuinely functional** recruitment SaaS, not a
prototype. The core product flows work end-to-end against the real API and
database, business rules are enforced **server-side** (not just in the UI), and
the test coverage is substantial.

- **Automated tests:** backend **955/955** pass (113 suites); frontend **101/101**
  pass (26 files).
- **Security:** RBAC, cross-tenant isolation (IDOR), auth hardening and
  assessment integrity all **passed** live probing. **No CRITICAL or HIGH
  vulnerability was found.**
- **Main issue is data hygiene, not code:** the shared dev/demo database is
  heavily polluted by e2e test runs (191 users / 122 companies vs the 3 seeded),
  which inflates admin analytics and undermines demo credibility.

**Verdict: `READY WITH FIXES`.** The code is close to production-ready; the
blockers for a *clean client demo* are data cleanup and a couple of
environment/config items — not functional or security defects.

---

## 2. Application Architecture (discovered)

| Layer | Stack |
|---|---|
| Backend | NestJS 11 (TypeScript, ESM), 19 modules, 49 controllers, **152 REST endpoints** under `/api/v1` |
| Data | PostgreSQL 16 via TypeORM (additive migrations), 45 tables |
| Async | Redis + BullMQ (queues, cron sweeps) |
| Frontend | Next.js 16 (App Router, Turbopack, standalone), React 19, TanStack Query |
| AuthN | JWT access/refresh, Argon2 hashing, optional TOTP MFA |
| AuthZ | Role guard (`admin/moderator/recruiter/company_admin/candidate`) + **entitlements matrix** (PACK→FEATURE→PERMISSION) with `@RequireFeature`/FeatureGuard |
| Ports/adapters | Mail, Mailer, Scoring, Payment (Stripe), Object storage (S3), OCR, File-scanner — all swappable by env driver |
| Infra | Docker, Helm, Terraform, OpenTelemetry; Render+Vercel deploy kit |

Key design strengths: hexagonal **ports/adapters**, a centralized **entitlements
matrix** (no scattered `if (plan===…)`), keyset (cursor) pagination, atomic
"claim" updates to avoid double-decision races.

---

## 3. Functional Testing → see `FUNCTIONAL_TESTS.md`

Verified live: auth, candidate profile/eligibility, assessments
(start→exam→submit→score), catalog, CVthèque search + pagination, shortlist,
jobs/applications, admin analytics. Core flows **work**.

## 4. Security Audit → see `SECURITY_AUDIT.md`

RBAC (candidate→admin/recruiter = 403), IDOR (cross-company job/applications =
403), auth negatives (401/400 + rate-limit 429), assessment anti-tamper (no
answer-key leak, double-submit blocked, forged score webhook rejected). **Strong.**

## 5. UX/UI Audit → see `UX_UI_AUDIT.md`

Landing + auth pages redesigned; CVthèque made responsive; brand logo in the
header. Open items are polish + one deliberate deviation (logo removed from
sign-in/up at the owner's request).

## 6. Performance → see `PERFORMANCE_AUDIT.md`

Indexes present on hot tables, keyset pagination, lazy sections. No deep load
profiling in this pass. Render free tier cold-start is the main prod caveat.

## 7. Bugs → see `BUGS.md`  ·  ## 8. Security findings → see `SECURITY_AUDIT.md`

## 9. Feature coverage / test matrix → see `TEST_MATRIX.md`

## 10. Fix roadmap → see `FIX_ROADMAP.md`

---

## 11. Deliverables

```
QA/
├── MAYSYNC_QA_AUDIT.md      (this file — summary + scores)
├── FUNCTIONAL_TESTS.md
├── SECURITY_AUDIT.md
├── UX_UI_AUDIT.md
├── PERFORMANCE_AUDIT.md
├── BUGS.md
├── TEST_MATRIX.md
└── FIX_ROADMAP.md
```

---

## 12. Bug counts

| Severity | Count |
|---|---|
| 🔴 CRITICAL | **0** |
| 🟠 HIGH | **0** |
| 🟡 MEDIUM | **2** (e2e data pollution; demo runs `NODE_ENV=development` → dev-only self-complete endpoint active) |
| 🟢 LOW | **3** (429 mislabeled; `/companies/me` 404 vs 403 for non-recruiter; minor UI polish) |
| 🔒 Security findings (exploitable in prod) | **0** |
| ⛔ BLOCKED / NOT TESTABLE | **6** (see below) |

**BLOCKED / NOT TESTABLE** (honest scoping — not claimed as pass or fail):
CV-import auto-fill (feature intentionally removed earlier), real-OCR school
extraction accuracy (`OCR_DRIVER=stub`), live email inbox delivery, browser-side
anti-cheat events in a real browser session, Stripe payments (keys empty/stub),
full multi-device visual responsive QA (needs a real browser matrix).

---

## 13. Global Score

| Axis | Score |
|---|---|
| Functional Quality | 88 / 100 |
| Security | 86 / 100 |
| UX / UI | 80 / 100 |
| Performance | 78 / 100 |
| Code Quality | 89 / 100 |
| Business Rules | 90 / 100 |
| **GLOBAL** | **85 / 100** |

### Conclusion: `READY WITH FIXES`

No blocking functional or security defect was found. Before a **client demo**,
do the P0/P1 items in `FIX_ROADMAP.md` (data cleanup, run the demo API in a
production/staging profile). Before **production**, address the P1/P2 items
(payments/OCR/email wired to real providers, a real-browser responsive + e2e
pass). The foundation is strong enough to be sold as a real SaaS.
