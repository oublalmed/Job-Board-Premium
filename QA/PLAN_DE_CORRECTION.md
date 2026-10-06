# SKILLINK — Plan de correction (Phase 2)

Basé sur l'audit (`QA/SKILLINK_QA_AUDIT.md`). **Rien n'est corrigé tant que tu
n'as pas validé ce plan.** Chaque lot indique l'effort, les fichiers touchés, le
risque, les dépendances et le critère d'acceptation (comment on vérifie que
c'est corrigé).

Légende exécution : 🤖 je le fais seul · 🔑 nécessite un accès/compte de ta part
· 🧩 décision produit à trancher.

---

## Vue d'ensemble (ordre recommandé)

| Lot | Thème | Priorité | Effort | Bloqué par |
|---|---|---|---|---|
| **L0** | Démo propre | P0 | ~1–2 h | — |
| **L1** | Correctifs code rapides | P1 | ~2–3 h | — |
| **L2** | Intégrations réelles | P1 | ~1–3 j | 🔑 comptes externes |
| **L3** | QA navigateur + perf | P2 | ~2–3 j | — |
| **L4** | Améliorations | P3 | post-release | 🧩/🔑 |

---

## L0 — Démo propre (P0 · à faire avant tout démo client)

### C1 — Nettoyer la base de démo 🤖
- **Problème** : BUG-1 — pollution e2e (191 users, 122 entreprises).
- **Approche** : script de purge non destructif (supprime les comptes/entreprises/
  abonnements générés par les tests, garde le seed `seed:testcases` + la banque de
  questions) **puis** isoler les tests e2e sur une **base dédiée** (variable
  `DB_DATABASE` distincte dans `test/jest-e2e`) pour qu'ils ne repolluent plus.
- **Fichiers** : nouveau script `src/database/clean-demo.ts` (+ npm script) ; config e2e.
- **Risque** : faible (données de test). **Non destructif** pour le seed.
- **Critère** : `GET /admin/analytics/overview` → ~3 entreprises, comptes seedés only.

### C2 — Lancer l'API démo en `production`/`staging` 🤖 (+ 🔑 config)
- **Problème** : BUG-2/SEC-1 — `complete-dev` actif en dev.
- **Approche** : démarrer l'API démo avec `NODE_ENV=production` (ou `staging`).
  Vérifier au boot que les variables requises (STORAGE, JWT…) sont valides.
- **Risque** : en prod, Swagger est désactivé et le stockage/mail doivent être
  configurés — à coordonner avec L2.
- **Critère** : `POST /assessments/{id}/complete-dev` → **403** ; `/api/v1/docs` indisponible.

---

## L1 — Correctifs code rapides (P1)

### C3 — Étiquette d'erreur 429 🤖
- **Problème** : BUG-3 — `429` renvoie `error:"Internal Server Error"`.
- **Approche** : mapper `ThrottlerException` dans `GlobalExceptionFilter` →
  `"Too Many Requests"`.
- **Fichiers** : `src/common/filters/http-exception.filter.ts` (+ test unitaire).
- **Effort** : ~30 min · **Risque** : très faible.
- **Critère** : hammer `/auth/login` → body `error:"Too Many Requests"`.

### C4 — RBAC `/companies/me` & `/companies/contact-quota` 🤖
- **Problème** : BUG-4 — 404 au lieu de 403 pour un non-recruteur.
- **Approche** : ajouter `@Roles(recruiter, company_admin)` sur ces routes.
- **Fichiers** : `src/modules/companies/company.controller.ts` (+ test).
- **Effort** : ~30 min · **Risque** : faible (vérifier qu'un recruteur légitime garde l'accès).
- **Critère** : candidat → **403** ; recruteur → **200**.

### C5 — Logo sur sign-in/up 🧩
- **Problème** : UX-1 — logo retiré à ta demande (écart vs brief).
- **Décision à trancher** : (a) on laisse sans logo, (b) on remet le logo. Je
  n'agis qu'après ton choix.

---

## L2 — Intégrations réelles (P1 · avant production) 🔑

Ces items **fonctionnent déjà en code** (ports/adapters prêts) ; il manque les
identifiants des services. Tu fournis les accès, je câble + teste.

| Item | Service | Ce qu'il me faut de toi | Critère |
|---|---|---|---|
| C6 — Emails | SMTP (ex. Brevo gratuit) | host/port/user/pass + from | email reçu (reset/verif) |
| C7 — Upload CV/diplôme | S3-compatible (Cloudflare R2 / Backblaze B2) | endpoint + keys + bucket | upload + preview OK |
| C8 — Vérif. école | `OCR_DRIVER=real` | (aucun compte, juste activer) | extraction d'un vrai diplôme |
| C9 — Paiements | Stripe | clé secrète + webhook secret | checkout + webhook signés |
| C10 — Durcissement upload | ClamAV (optionnel) | daemon clamd (ou on garde stub) | fichier malveillant rejeté |

- **Risque** : moyen (comportement réel des providers). On teste chacun isolément.

---

## L3 — QA navigateur + performance (P2 · avant release finale) 🤖

### C11 — Passe Playwright (e2e + responsive)
- **Approche** : scaffolder Playwright, scénarios critiques (candidat :
  inscription→profil→évaluation→candidature ; recruteur : recherche→shortlist→
  contact), + captures multi-viewport (1920/1366/768/390), + sweep erreurs
  console/network.
- **Dépendance** : installe une dépendance dev (Playwright) → **validation requise**
  (le brief interdit d'installer sans accord).
- **Critère** : parcours verts + 0 erreur console bloquante + pas d'overflow mobile.

### C12 — Performance
- N+1 avec `DB_LOGGING=true` sur CVthèque + analytics ; `k6` sur `/search`
  (scaffold `test/load/k6-search.js` existe) ; Lighthouse sur les pages clés.
- **Critère** : pas de N+1 majeur ; p95 recherche raisonnable ; budget bundle noté.

### C13 — Image auth locale 🤖 (🔑 si tu veux ta propre image)
- Remplacer l'URL Unsplash par un asset local optimisé (`next/image`).

---

## L4 — Améliorations (P3 · après release)

- C14 — Référentiel écoles administrable (remplacer la liste statique). 🤖
- C15 — Google Sign-In (le bouton « Continue with Google » de la maquette). 🔑
- C16 — e2e front dans la CI (actuellement CI = coverage backend only). 🤖

---

## Ce que je peux lancer immédiatement (sans accès externe)

**L0 (C1, C2) + L1 (C3, C4)** — c'est le lot qui rend la démo propre et solide.
~4–5 h de travail, zéro dépendance externe, faible risque.

Les décisions en attente : **C5** (logo auth), **C11** (autorisation d'installer
Playwright), et les **accès L2** (SMTP/S3/OCR/Stripe) quand tu les auras.

---

## Enchaînement global

```
L0 → L1   (je peux faire maintenant)
   → C5 décision
L2         (quand tu fournis les accès)
L3         (C11 après autorisation Playwright)
L4         (post-release)

Puis : PHASE 3 re-test → PHASE 4 régression → PHASE 5 production readiness
```

Après chaque lot : je relance les suites (955 back / 101 front), je re-teste en
live les points corrigés, et je te donne un mini rapport avant de passer au lot
suivant.
