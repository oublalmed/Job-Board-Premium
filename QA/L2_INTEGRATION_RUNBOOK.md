# Skillink — L2 Integration & Deployment Runbook

**Goal:** go from the current demo (stub drivers, local DB) to a live
Vercel (frontend) + Render (API + Postgres + Redis) environment with the
real third-party integrations switched on.

**Status legend**
- 🟢 **Env-only** — the code is already wired; you set credentials and flip a variable.
- 🔴 **Code needed** — an adapter must be written first (flagged explicitly below).

| Integration | Readiness | What's needed |
|---|---|---|
| Email (SMTP) | 🟢 Env-only | Relay credentials (e.g. Brevo free tier) |
| OCR (diploma text extraction) | 🟢 Env-only | `OCR_DRIVER=real` — no external account (tesseract.js runs in-process) |
| Payments (Stripe) | 🟢 Env-only | Stripe keys + webhook secret |
| Object storage (CV / diploma files) | 🔴 **Code needed** | No S3 adapter exists yet — see §4 |

---

## 0. Pre-flight — generate the secrets

Run these once and keep the output in your password manager; paste into Render env.

```bash
# JWT access + refresh secrets, MFA key, webhook secrets (32-byte hex each)
node -e "for(const k of ['JWT_ACCESS_SECRET','JWT_REFRESH_SECRET','MFA_ENCRYPTION_KEY','SCORING_WEBHOOK_SECRET'])console.log(k+'='+require('crypto').randomBytes(32).toString('hex'))"
```

**Non-negotiable production values** (differ from the demo):
- `NODE_ENV=production` — disables the dev-only `/assessments/{id}/complete-dev` self-complete endpoint and Swagger.
- `DB_SYNCHRONIZE=false` — schema only ever changes through migrations (ADR-0002).
- `DB_SSL=true` — Render Postgres is reached over the network.
- `CORS_ORIGIN=https://<your-vercel-domain>` and `APP_WEB_URL=https://<your-vercel-domain>` — not `*`.

---

## 1. Email / SMTP 🟢

**Code:** `MAIL_DRIVER=smtp` routes **both** the auth mailer (magic links, verification)
and the notification mailer through `SmtpMailAdapter` / `SmtpMailerAdapter`
(`src/ports/ports.module.ts`). Default `log` only prints links to the console —
that is why "emails were never received" in the demo.

**Recommended free relay: Brevo (ex-Sendinblue)** — 300 emails/day free, no card.
Alternatives: Resend, Mailgun, Amazon SES.

```env
MAIL_DRIVER=smtp
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<your-brevo-login>
SMTP_PASSWORD=<your-brevo-smtp-key>     # the SMTP key, NOT the account password
MAIL_FROM=Skillink <no-reply@your-domain>
```

**Deliverability:** verify a sending domain in Brevo and add its SPF + DKIM DNS
records, otherwise mail lands in spam. A plain `@gmail.com` From will be rejected
or spam-filed — use a domain you control.

**Validate live:** register a new account → confirm the verification email
arrives; trigger "forgot password" → confirm the reset link arrives and works.

---

## 2. OCR — school/diploma verification 🟢

**Code:** `OCR_DRIVER=real` selects `RealOcrAdapter` (`ocr.factory.ts`):
`pdf-parse` for PDFs + `tesseract.js` (fra+eng) for scanned images. Both deps are
already installed — **no external account or API key needed**; it runs in-process.

```env
OCR_DRIVER=real
```

**Caveat (Render):** `tesseract.js` downloads its language traineddata and a WASM
core on first use, and OCR is CPU-heavy. On Render's free/512 MB tier a cold
first extraction can be slow or memory-pressured. Mitigate by doing OCR in the
**BullMQ worker** (already the async path) rather than inline, and size the worker
instance accordingly. Keep an eye on the first run.

**Recall the hard rule (already enforced, keep it):** an **unreferenced** school is
**never** auto-approved regardless of OCR confidence — it stays *"En attente de
validation admin"* (`school-verification.service.ts`). Real OCR does not change this.

**Validate live:** upload a diploma from a referenced grande école (high-quality
scan) → auto-verified; upload one from an unlisted school → stays pending for admin.

---

## 3. Payments — Stripe 🟢

**Code:** `StripePaymentProvider` is always active; webhook signature verification
fails closed if `STRIPE_WEBHOOK_SECRET` is empty.

```env
STRIPE_SECRET_KEY=sk_test_...        # test mode first, then sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...      # from the Stripe dashboard webhook endpoint
```

**Setup:**
1. Create the webhook endpoint in Stripe → `https://<api-domain>/api/v1/webhooks/payment`.
2. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Local testing: `stripe listen --forward-to localhost:3000/api/v1/webhooks/payment`.

**Validate live (test mode):** run a subscription checkout with card `4242 4242
4242 4242` → subscription becomes `ACTIVE`; replay/forge a webhook with a bad
signature → rejected.

---

## 4. Object storage — CV & diploma files 🔴 **CODE NEEDED**

**Current reality:** `OBJECT_STORAGE` is hardcoded to `StubObjectStorageAdapter`
(`ports.module.ts` line ~78). There is **no S3 adapter in the codebase** and
`@aws-sdk/client-s3` is **not installed**. The `STORAGE_*` env vars exist and are
validated, but nothing consumes them yet. Uploaded files are not persisted to a
real bucket.

**To enable real storage (small, well-scoped task — needs your go-ahead):**
1. `npm i @aws-sdk/client-s3` (S3-compatible; works with Cloudflare R2 / Backblaze B2 / MinIO).
2. Write `src/adapters/object-storage/s3-object-storage.adapter.ts` implementing
   the existing `ObjectStoragePort` (put/get/presign/delete) against the AWS SDK.
3. Add a `storageProviderFactory` keyed on a new `STORAGE_DRIVER` (`stub` | `s3`),
   mirroring the OCR factory, and wire it in `ports.module.ts`.
4. Keep the stub as the default so CI/tests stay hermetic.

**Recommended free-tier bucket: Cloudflare R2** (10 GB free, no egress fees) or
Backblaze B2. Once the adapter exists:

```env
STORAGE_DRIVER=s3
STORAGE_ENDPOINT=https://<account>.r2.cloudflarestorage.com
STORAGE_ACCESS_KEY=<r2-access-key>
STORAGE_SECRET_KEY=<r2-secret-key>
STORAGE_BUCKET=skillink
STORAGE_REGION=auto
STORAGE_FORCE_PATH_STYLE=true
```

> Tell me to proceed and I'll implement the adapter + factory (≈1 small lot,
> with unit tests), so it's just-add-credentials afterwards like the others.

---

## 5. Antivirus (upload scanning) — optional hardening

`ANTIVIRUS_DRIVER` + `CLAMAV_HOST`/`CLAMAV_PORT`. Render has no managed ClamAV; run
it as a separate service/container or leave the driver on its no-op default for the
first release (CV/diploma uploads are size- and MIME-constrained regardless). Flag
this as a P1 security item once storage (§4) is live.

---

## 6. Deployment topology

```
Vercel  ──────────────►  frontend (Next.js standalone)
  env: NEXT_PUBLIC_API_URL=https://<api-domain>/api/v1

Render  ──────────────►  Web Service: API (NestJS)        NODE_ENV=production
         ├──────────────  Postgres (managed)              DB_SSL=true
         ├──────────────  Redis / Key-Value (managed)     REDIS_* 
         └──────────────  Background Worker: BullMQ        (OCR, emails, sweeps)
```

**One-time DB setup on Render Postgres:**
```bash
DB_DATABASE=<render-db> npm run migration:run   # never DB_SYNCHRONIZE=true
npm run seed:testcases                          # demo data — SKIP for a real tenant
```

**CORS/URL wiring:** set `CORS_ORIGIN` and `APP_WEB_URL` to the Vercel domain on
the API, and `NEXT_PUBLIC_API_URL` to the Render API domain on Vercel. Mismatches
here are the #1 cause of "works locally, blank/401 in prod".

---

## 7. Go-live validation checklist

- [ ] `NODE_ENV=production` → `GET /api/v1/.../complete-dev` returns **403/404**, Swagger disabled.
- [ ] Register → verification email received (real inbox, not spam).
- [ ] Forgot-password → reset link received and completes.
- [ ] Stripe test checkout → subscription `ACTIVE`; forged webhook rejected.
- [ ] Diploma upload (referenced school) → auto-verified; (unlisted) → pending admin.
- [ ] CV upload → persisted and re-downloadable **(blocked on §4)**.
- [ ] CORS: frontend on Vercel talks to API on Render with no console CORS errors.
- [ ] DB over TLS (`DB_SSL=true`), migrations applied, `DB_SYNCHRONIZE=false`.

---

### What I need from you to finish L2
1. **SMTP** — Brevo (or other) SMTP host/user/key + a sending domain → §1.
2. **Stripe** — test (then live) secret key + webhook secret → §3.
3. **Storage** — a yes to implement the S3 adapter (§4), then R2/B2 credentials.
4. OCR needs **nothing from you** — just `OCR_DRIVER=real` at deploy.
