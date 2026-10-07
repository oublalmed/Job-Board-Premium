# SKILLINK — Bugs & Anomalies (Phase 1)

No CRITICAL or HIGH. Items below are MEDIUM/LOW, evidence-based.

| ID | Severity | Module | Problem | Steps to reproduce | Expected | Actual |
|---|---|---|---|---|---|---|
| BUG-1 | 🟡 MEDIUM | Data / Analytics | Shared dev/demo DB is polluted by e2e test runs — **191 users, 122 companies, 103 recruiters**, 7 `past_due` subscriptions, (previously E2E specialties, now deactivated). | Login as admin → `GET /admin/analytics/overview` | Numbers reflect the 3 seeded companies / handful of users | `users.total=191, companies.total=122, subscriptions.active=107` — inflated, not credible for a demo |
| BUG-2 | 🟡 MEDIUM | Assessments / Env | On the running demo (`NODE_ENV=development`) `POST /assessments/{id}/complete-dev` lets a candidate self-complete & score an attempt. | As candidate, start an attempt, POST `/assessments/{id}/complete-dev` | Not available outside local dev | Works on the demo instance (hard-guarded off only when `NODE_ENV=production`) |
| BUG-3 | 🟢 LOW | Throttling / Errors | `429` rate-limit responses are mislabeled. | Hammer `POST /auth/login` | body `error:"Too Many Requests"` | `429` with body `error:"Internal Server Error", message:"ThrottlerException…"` |
| BUG-4 | 🟢 LOW | Companies / RBAC | Non-recruiter gets `404` instead of `403`. | As candidate, `GET /companies/me` or `/companies/contact-quota` | `403 Forbidden` (role-guarded) | `404` (endpoint not role-guarded; just finds no company) |
| BUG-5 | 🟢 LOW | UI / Branding | Per `§21` of the brief the logo should appear on Sign-in/Sign-up, but it was **removed there at the owner's explicit request**. | Open `/login`, `/register` | (brief) logo present | logo intentionally absent (deliberate deviation, documented) |

## Notes / non-bugs investigated and cleared

- **Shortlist "candidate info disappears"** — *not reproduced*; the shortlist
  entry keeps full candidate data after add (returns 409 on duplicate).
- **"Orphan job_applications (6)"** — *false positive*; `job_applications.candidate_id`
  references `users.id` (6/6 match), not `candidate_profiles.id`. Integrity clean.
- **CVthèque pagination "not working"** — was a page-size issue (20 ≥ 18 indexed
  candidates); fixed to 12/page this cycle; cursor paging verified.
- **Auth negatives initially "failing"** — were rate-limit (`429`) side effects of
  rapid probing; in isolation they return the correct `401/400`.

## Referential-integrity checks (all clean, expect 0)

orphan applications (no job) = 0 · orphan recruiters (no company/user) = 0 ·
orphan candidate_profiles (no user) = 0 · orphan assessments (no test) = 0 ·
duplicate user emails = 0 · duplicate (candidate,job) applications = 0 ·
null emails = 0. Indexes present on `job_applications`, `candidate_profiles`,
`scores`.
