# SKILLINK — Fix Roadmap (recommended order)

No fix has been applied (Phase 1 = audit only). This is the proposed order;
awaiting your validation before Phase 2.

## P0 — Blocker (do before any client demo)

1. **Clean the demo database.** Remove e2e-test pollution so admin analytics and
   the CVthèque reflect the real seeded data. Re-run `npm run seed:testcases` on
   a fresh DB, and keep e2e tests on a **separate** database so they stop
   polluting it. *(BUG-1)*
2. **Run the demo/staging API with `NODE_ENV=production` (or `staging`).** This
   disables the dev-only `/assessments/{id}/complete-dev` self-complete endpoint.
   *(BUG-2 / SEC-1)*

## P1 — Critical (before production)

3. Wire **real providers** and validate live: Stripe (payments), SMTP relay
   (email delivery), S3-compatible storage (CV/diploma uploads), `OCR_DRIVER=real`
   for school verification.
4. **Security hardening pass with real drivers:** upload spoofing/MIME/path-traversal
   on CV + diploma, ClamAV scanning path, Stripe webhook signature verification.
5. Fix `429` error labelling (`ThrottlerException` → "Too Many Requests"). *(BUG-3)*
6. Add the recruiter role guard to `/companies/me` + `/companies/contact-quota`
   so non-recruiters get `403`, not `404`. *(BUG-4)*

## P2 — Important (before final release)

7. **Real-browser QA pass** (Playwright): multi-viewport responsive
   (1920/1366/768/390), console/network error sweep, e2e of the critical journeys
   (candidate signup→profile→assessment→apply; recruiter search→shortlist→contact).
8. Decide the **sign-in/up logo** question (currently removed on purpose) for
   brand consistency; ship a **local** auth image instead of the Unsplash URL.
   *(UX-1, UX-2)*
9. Performance: N+1 sweep with `DB_LOGGING`, k6 load on search, Lighthouse budget.
   *(PERF-1..4)*

## P3 — Improvement (after release)

10. Admin-managed school referential (replace the static grande-école list).
11. Google / social sign-in (the reference auth design had a "Continue with
    Google" button we intentionally omitted — add it only once OAuth is wired).
12. Broaden e2e coverage; wire frontend tests into CI (currently CI runs backend
    coverage only).

---

### Next phases (after your validation)

```
PHASE 2 — CORRECTIONS (P0 → P1 → P2)
PHASE 3 — RE-TEST
PHASE 4 — REGRESSION
PHASE 5 — PRODUCTION READINESS
```
