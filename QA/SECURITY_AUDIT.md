# SKILLINK — Security Audit (Phase 1)

All checks were run **live** against `http://localhost:3000/api/v1` with the
seeded test accounts. Evidence = actual HTTP status codes observed.

## Summary

**No CRITICAL or HIGH, no exploitable-in-production vulnerability found.** RBAC,
multi-tenant isolation, authentication and assessment anti-tamper are all
enforced server-side.

## 1. Authentication

| Test | Result | Status |
|---|---|---|
| Valid credentials | token issued | ✅ |
| Wrong password | `401 Invalid credentials` | ✅ |
| Unknown user | `401 Invalid credentials` (no user enumeration) | ✅ |
| Empty body | `400` validation (`email must be an email`…) | ✅ |
| No token on protected route | `401` | ✅ |
| Rapid repeated logins | `429` (rate-limited) | ✅ (limiter active) |

Passwords hashed with Argon2; JWT access/refresh; optional TOTP MFA.

## 2. Authorization (RBAC)

| Actor → Endpoint | Expected | Observed |
|---|---|---|
| candidate → `/admin/analytics/overview` | 403 | **403** ✅ |
| candidate → `/admin/subscriptions` `/admin/school-verifications` `/admin/audit-logs` `/admin/profiles` `/admin/settings` | 403 | **403** ✅ |
| candidate → `/recruiter/jobs` `/recruiter/analytics/overview` `/companies/shortlist` | 403 | **403** ✅ |
| candidate → `/search/candidates` (CVthèque) | 403 | **403** ✅ |
| recruiter → `/admin/*` | 403 | **403** ✅ |
| admin → `/admin/analytics/overview` (positive) | 200 | **200** ✅ |
| no token → `/candidates/profile`, `/search/candidates` | 401 | **401** ✅ |

## 3. IDOR / multi-tenant isolation

| Test | Observed |
|---|---|
| Starter recruiter → **another company's** job (`/recruiter/jobs/{foreignId}`) | **403** ✅ |
| Starter recruiter → **another company's** job applications | **403** ✅ |

Cross-tenant data access is blocked at the service layer (ownership scoped by the
JWT subject's company), not just hidden in the UI.

## 4. Assessment anti-tamper (critical for a scoring product)

| Test | Observed |
|---|---|
| `GET /assessments/{id}/exam` leaks correct answers? | **No** — payload keys = `id,type,domain,prompt,options,timeLimitSeconds` (no `correctAnswer`) ✅ |
| Per-question timer enforced | `timeLimitSeconds` present per question ✅ |
| Submit the same attempt twice | 1st `201`, 2nd **`400`** (rejected) ✅ |
| Candidate forges a score via `POST /assessments/webhook` | **`403`** ✅ |
| Server-strict deadline / proctoring auto-invalidation | verified earlier in project (403 TIME_EXCEEDED → incident; 12 leaves → incident) ✅ |

## 5. Entitlements gating

| Test | Observed |
|---|---|
| Anti-cheat feature for a **Premium** recruiter (`/anti-cheat/setting`) | **403** (disabled for recruiters by product decision, matrix-driven) ✅ |

## 6. Security findings (non-blocking)

| ID | Severity | Finding | Recommendation |
|---|---|---|---|
| SEC-1 | 🟡 MEDIUM | Demo API runs `NODE_ENV=development`, so `POST /assessments/{id}/complete-dev` is **active** — a candidate can self-complete/score an attempt. It is hard-guarded to non-production (`NODE_ENV==='production' → 403`), so this is an **environment** issue, not a code hole. | Run the demo/staging API with `NODE_ENV=production` (or `staging`) so the dev-only endpoint is disabled. |
| SEC-2 | 🟢 LOW | `429` throttle responses carry body `error:"Internal Server Error"` instead of `"Too Many Requests"` (status code itself is correct). | Map `ThrottlerException` in the global exception filter to the proper error label. |
| SEC-3 | 🟢 LOW | `/companies/me` and `/companies/contact-quota` return **404** to a candidate instead of **403** (no role guard; they just fail to find a company). No data leak. | Add the recruiter role guard so non-recruiters get a clean 403. |

## 7. Not tested in this pass (BLOCKED)

- Upload spoofing / MIME / path traversal on `/candidates/cv` and diploma upload
  (file-scanner is `stub`; antivirus `clamav` path not exercised).
- SQLi/NoSQLi: TypeORM parameterized queries + class-validator DTOs make this
  low-risk by construction, but no fuzzing pass was run.
- Stripe/payment webhook signature verification (keys are empty/stub).

All of the above are **config/driver-dependent**; the code paths exist and are
unit-tested, but live validation needs the real providers enabled.
