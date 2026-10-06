# SKILLINK — Test / Feature Coverage Matrix (Phase 1)

Legend: ✅ pass (verified live) · 🧪 covered by automated tests · ⛔ blocked/not testable this pass

| Module | Feature | Test | Result |
|---|---|---|---|
| Auth | Login (valid/invalid/unknown/empty) | live | ✅ 200/401/401/400 |
| Auth | Rate limiting | live | ✅ 429 |
| Auth | MFA (TOTP) | auto | 🧪 |
| RBAC | candidate → admin/recruiter surfaces | live | ✅ 403 |
| RBAC | admin → admin (positive) | live | ✅ 200 |
| RBAC | unauth → protected | live | ✅ 401 |
| IDOR | recruiter → foreign company job / applications | live | ✅ 403 |
| Candidate | Profile CRUD + completeness | live | ✅ |
| Candidate | Eligibility (≥70% + 1 exam) | live | ✅ eligible→apply 201 |
| Application | Create / duplicate guard | live | ✅ 201 / unique |
| Assessment | Catalog (specialties/tests) | live | ✅ 10/10, clean names |
| Assessment | Start → exam (no answer-key leak) | live | ✅ |
| Assessment | Per-question timer | live | ✅ |
| Assessment | Submit / double-submit | live | ✅ 201 / 400 |
| Assessment | Forged score webhook | live | ✅ 403 |
| Assessment | Cooldown / deadline / proctoring void | prior + auto | ✅ / 🧪 |
| School verif | Referenced + OCR≥92 → auto-approve | auto | 🧪 |
| School verif | Unreferenced → always PENDING | live + auto | ✅ |
| School verif | Real-OCR extraction accuracy | — | ⛔ (OCR stub) |
| CVthèque | Search + keyset pagination | live | ✅ 12/page + cursor |
| CVthèque | Score ordering / filters | auto | 🧪 |
| Shortlist | Add / duplicate / data persists | live | ✅ 201 / 409 / non-empty |
| Entitlements | Anti-cheat gated (recruiter 403) | live | ✅ |
| Admin | Analytics overview / subscriptions | live | ✅ 200 |
| Admin | School-verif queue / verify / reject | auto | 🧪 |
| Jobs | Public list/detail; recruiter CRUD/publish | auto | 🧪 |
| CV import | Auto-fill from CV | — | ⛔ (feature removed) |
| Billing | Stripe checkout / webhook | — | ⛔ (keys stub) |
| Mail | Verification / reset / notifications | partial | ⛔ live inbox (SMTP→Mailpit only) |
| DB | Referential integrity / orphans / duplicates | live | ✅ 0 orphans |

**Automated totals:** backend **955/955** (113 suites) · frontend **101/101** (26 files).
