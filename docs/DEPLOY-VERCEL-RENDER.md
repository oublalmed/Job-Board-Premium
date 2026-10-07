# Déployer Cobalt gratuitement — Backend sur Render, Frontend sur Vercel

Objectif : une plateforme en ligne, 100 % gratuite, démontrable à un client.
Tu crées 2 comptes (via « Continuer avec GitHub »), tout le reste est pré-câblé
dans le dépôt (`render.yaml`). Compte ~20 min.

Architecture :

```
Navigateur ──► Frontend Next.js (Vercel)  ──►  Backend NestJS (Render)
                                                 ├── PostgreSQL (Render, gratuit)
                                                 └── Redis / Key Value (Render, gratuit)
```

> Limites du gratuit (à savoir pour la démo) : le backend Render s'endort après
> 15 min sans trafic (1er appel ensuite = réveil ~30-50 s) ; la base PostgreSQL
> gratuite **expire après 30 jours**. Parfait pour une démo, pas pour la prod.

---

## Étape 1 — Backend + base + Redis sur Render

1. Va sur **https://render.com** → **Get Started** → **Continue with GitHub**.
2. Autorise Render à accéder au dépôt **`oublalmed/Job-Board-Premium`**.
3. Dashboard → **New +** → **Blueprint**.
4. Sélectionne le dépôt. Render détecte **`render.yaml`** et liste 3 ressources :
   `cobalt-db` (PostgreSQL), `cobalt-redis` (Key Value), `cobalt-api` (web).
5. Clique **Apply**. Render demande de renseigner les 2 variables laissées vides :
   - `CORS_ORIGIN` → mets **`https://PLACEHOLDER`** pour l'instant (on la corrige à l'étape 3).
   - `APP_WEB_URL` → mets **`https://PLACEHOLDER`** aussi.
   (On ne connaît l'URL Vercel qu'après l'étape 2 ; on reviendra les corriger.)
6. Lance le déploiement. Le premier build prend ~5-8 min (install + build + 54 migrations).
7. Quand `cobalt-api` est **Live**, note son URL, du type :
   **`https://cobalt-api.onrender.com`** → c'est l'**URL du backend**.
8. Vérifie : ouvre `https://cobalt-api.onrender.com/api/v1/health/live` → doit répondre `{"status":"ok"}`.

### Charger les données de démo (comptes de test)

Toujours sur Render, service **cobalt-api** → onglet **Shell** → exécute :

```bash
npm run seed:testcases
```

Cela crée les comptes de [docs/COMPTES_TEST.md](COMPTES_TEST.md) (admin, 3 recruteurs
Starter/Pro/Premium, 3 candidats) et garde la banque de questions. Mot de passe
commun : `Password123!`.

---

## Étape 2 — Frontend sur Vercel

1. Va sur **https://vercel.com** → **Sign Up** → **Continue with GitHub**.
2. **Add New… → Project** → importe **`oublalmed/Job-Board-Premium`**.
3. Configuration du projet :
   - **Root Directory** : clique **Edit** et choisis **`frontend`** (important — le front est dans ce sous-dossier).
   - **Framework Preset** : Next.js (détecté automatiquement).
   - **Build / Install** : laisse les valeurs par défaut.
4. **Environment Variables** → ajoute :
   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_API_BASE_URL` | `https://cobalt-api.onrender.com` |
   (⚠️ l'URL **exacte** du backend de l'étape 1, **sans** `/api/v1`, **sans** slash final.)
5. Clique **Deploy**. Build ~2-3 min.
6. Note l'URL du front, du type **`https://cobalt-xxxx.vercel.app`** → c'est le **lien à partager**.

---

## Étape 3 — Relier les deux (CORS)

Retour sur **Render → cobalt-api → Environment** : corrige les 2 variables avec
l'URL Vercel réelle de l'étape 2, puis **Save** (le service redémarre) :

| Variable | Valeur |
|----------|--------|
| `CORS_ORIGIN` | `https://cobalt-xxxx.vercel.app` |
| `APP_WEB_URL` | `https://cobalt-xxxx.vercel.app` |

> `CORS_ORIGIN` doit être l'URL **exacte** du front (pas de `*`) : l'API renvoie
> `Allow-Credentials`, incompatible avec un wildcard.

---

## C'est en ligne ✅

- **Lien démo (à partager au client)** : l'URL Vercel.
- **Connexion** : comptes de [docs/COMPTES_TEST.md](COMPTES_TEST.md), mot de passe `Password123!`.
- Si la 1ʳᵉ page met ~30 s : c'est le réveil du backend Render (plan gratuit).

### Déjà couvert / à prévoir
- ✅ Login, CVthèque, offres, candidatures, évaluations (chrono + anti-triche), analytics recruteur & admin.
- ⚠️ **Upload de fichiers** (CV/diplôme) : nécessite un vrai bucket S3. Remplace sur
  Render `STORAGE_ENDPOINT` / `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` par des
  identifiants **Cloudflare R2** ou **Backblaze B2** (gratuits, compatibles S3).
- ⚠️ **Emails** : en mode `log` par défaut (aucun email réellement envoyé — le lien
  s'affiche dans les logs). Pour de **vrais envois**, sur Render → cobalt-api →
  Environment, ajoute :
  | Variable | Valeur |
  |----------|--------|
  | `MAIL_DRIVER` | `smtp` |
  | `NOTIFICATIONS_EMAIL_ENABLED` | `true` |
  | `SMTP_HOST` | ex. `smtp-relay.brevo.com` |
  | `SMTP_PORT` | `587` |
  | `SMTP_USER` | identifiant du relais |
  | `SMTP_PASSWORD` | clé SMTP du relais |
  | `MAIL_FROM` | ex. `Vocatic <no-reply@tondomaine.ma>` |

  Un fournisseur gratuit (Brevo, ~300 emails/jour) suffit pour une démo. Les deux
  canaux — transactionnel (vérification, réinitialisation) **et** notifications
  (profil consulté, cooldown) — passent désormais par ce relais.

### Redéployer après une mise à jour du code
Push sur la branche → Render et Vercel redéploient automatiquement (auto-deploy on push).
