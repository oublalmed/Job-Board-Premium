# SKILLINK — Functional Tests (Phase 1)

Live results against the running API + DB, plus automated suites.

## Automated suites

| Suite | Result |
|---|---|
| Backend unit/integration (`jest`) | **955 / 955 pass**, 113 suites |
| Frontend (`vitest`) | **101 / 101 pass**, 26 files |
| i18n parity (fr/en/ar) | equal key sets (1034 leaves) ✅ |

## Candidate

| Area | Observed | Status |
|---|---|---|
| Register / login | works; validation + rate-limit enforced | ✅ |
| Profile (`GET/PUT /candidates/profile`) | own profile only; persisted | ✅ |
| Profile completeness (`/candidates/profile/completeness`) | returns `completeness` %; drives eligibility | ✅ |
| **Application eligibility** (`/jobs/mine/eligibility`) | `{eligible:true, completeness:85, threshold:70, completedAssessments:1}` | ✅ |
| **Apply** (`POST /jobs/{id}/apply`) | eligible candidate → `201` application created; ineligible blocked server-side | ✅ |
| Duplicate application | unique (cand,job); second attempt rejected | ✅ |

### Eligibility rule matrix (enforced backend)

Rule: `completeness ≥ 70% AND ≥ 1 completed assessment`. Verified the eligible
path live (85% + 1 exam → eligible → apply 201). The negative branches are
enforced in `jobs` service + covered by unit tests.

## Assessments

| Test | Observed | Status |
|---|---|---|
| Catalog (`/specialties`, `/tests`) | 10 clean FR specialties, 10 active tests, **no E2E names** | ✅ |
| Start (`/assessments/start`) | `201`, status `in_progress` | ✅ |
| Exam (`/assessments/{id}/exam`) | 30 questions, **answer keys stripped**, per-question `timeLimitSeconds` | ✅ |
| Submit | `201`; **double-submit → 400** | ✅ |
| Forged score webhook (candidate) | **403** | ✅ |
| Cooldown / server deadline / proctoring invalidation | verified earlier in project | ✅ |

## Recruiter / Company

| Area | Observed | Status |
|---|---|---|
| CVthèque search (`/search/candidates`) | returns items + `nextCursor` (keyset pagination) | ✅ |
| Pagination | 12 / page, Next fetches next cursor page (fixed this cycle) | ✅ |
| Shortlist add | `201`; candidate entry **present & non-empty** | ✅ |
| Shortlist duplicate | **409** (idempotent) | ✅ |
| Cross-company access | blocked (see SECURITY_AUDIT §3) | ✅ |

> Note on the earlier "shortlist candidate info disappears" concern: **not
> reproduced** — the shortlist entry carries full candidate data after add.

## Admin

| Area | Observed | Status |
|---|---|---|
| `/admin/analytics/overview` | `200`, real aggregates (users/companies/subs/jobs/assessments) | ✅ |
| `/admin/subscriptions/companies` | `200` | ✅ |
| School verifications queue / verify / reject | endpoints present; unreferenced-school → stays PENDING (verified earlier) | ✅ |

## School verification (business rule)

- Referenced school + OCR ≥ 92% → **auto-approved** (unit-tested).
- OCR < 92% (matched) → **PENDING** admin review.
- **Unreferenced school → always PENDING**, even at 100% OCR (verified: test +
  live), labelled "École non référencée" in the admin queue and "En attente de
  validation admin" to the candidate.
- Real-OCR *extraction accuracy* = **BLOCKED** (`OCR_DRIVER=stub`).

## Jobs

- `GET /jobs`, `GET /jobs/{id}` public; recruiter CRUD + publish/close present.
- Seed state: 3 job offers (2 published). Low volume is seed data, not a defect.

## BLOCKED / NOT TESTABLE (not counted pass/fail)

- CV import auto-fill (§5 of the brief) — feature was intentionally removed
  earlier (OCR of free-form CVs was unreliable). `/candidates/cv` stores the file
  but does not pre-fill the profile.
- Email inbox delivery (SMTP→Mailpit locally; not an external inbox here).
- Payments (Stripe keys empty).
