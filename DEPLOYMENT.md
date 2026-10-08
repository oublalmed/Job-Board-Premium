# MaySync — Déploiement gratuit, pas à pas

Architecture de prod : **backend sur Render** (API NestJS + PostgreSQL + Redis)
et **frontend sur Vercel** (Next.js). 100 % gratuit, avec les limites du gratuit
notées à la fin.

> Durée : ~30–45 min. Ne saute aucune étape ; l'ordre compte (le backend
> d'abord, car le frontend a besoin de son URL).

---

## 0. Prérequis (5 min) — créer les comptes gratuits

1. **GitHub** — ton code y est déjà (`oublalmed/Job-Board-Premium`).
2. **Render** → https://render.com → *Sign up with GitHub*.
3. **Vercel** → https://vercel.com → *Sign up with GitHub*.
4. *(Recommandés, pour emails + upload de fichiers réels — faisables plus tard)*
   - **Brevo** (emails) → https://www.brevo.com (300 emails/j gratuits)
   - **Cloudflare R2** (stockage CV/diplômes) → https://dash.cloudflare.com (10 Go gratuits)

Autorise Render et Vercel à accéder à ton dépôt GitHub quand ils le demandent.

---

## 1. Backend sur Render (le Blueprint fait tout) — 10 min

Le fichier `render.yaml` à la racine décrit déjà **3 ressources** (base PostgreSQL,
Redis, API) et génère les secrets JWT automatiquement.

1. Render Dashboard → **New +** → **Blueprint**.
2. Sélectionne le dépôt **Job-Board-Premium** → **Connect**.
3. Render lit `render.yaml` et affiche 3 ressources :
   `cobalt-db`, `cobalt-redis`, `cobalt-api`. Clique **Apply**.
4. Render va :
   - créer la base PostgreSQL + le Redis,
   - builder l'API (`npm ci --include=dev && npm run build`),
   - **lancer les migrations puis démarrer l'API** (`npm run migration:run && node dist/main.js`).
5. Attends que `cobalt-api` passe à **Live** (3–6 min). Health check : `/api/v1/health/live`.
6. **Note l'URL de l'API**, ex. `https://cobalt-api.onrender.com`. ← tu en auras besoin à l'étape 2.

> À ce stade, l'API tourne mais n'accepte pas encore le front (CORS). On règle ça à l'étape 3.
> Les variables `CORS_ORIGIN` et `APP_WEB_URL` sont volontairement vides pour l'instant.

---

## 2. Frontend sur Vercel — 5 min

1. Vercel Dashboard → **Add New…** → **Project** → importe **Job-Board-Premium**.
2. **Configuration importante** (le front est dans un sous-dossier) :
   - **Root Directory** → clique *Edit* → choisis **`frontend`**.
   - Framework Preset : **Next.js** (auto-détecté).
   - Build/Install : laisse par défaut.
3. **Environment Variables** → ajoute :

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_API_BASE_URL` | l'URL Render de l'étape 1 (ex. `https://cobalt-api.onrender.com`) — **sans** `/api/v1` à la fin, **sans** slash final |

4. **Deploy**. Attends le build (~2 min).
5. **Note l'URL Vercel**, ex. `https://maysync.vercel.app`. ← nécessaire à l'étape 3.

---

## 3. Relier front ↔ back (CORS) — 3 min — **étape critique**

L'API doit autoriser **exactement** l'URL du front (pas de `*`, car elle envoie
des cookies/credentials).

1. Render → service **cobalt-api** → **Environment** → ajoute/renseigne :

   | Key | Value |
   |---|---|
   | `CORS_ORIGIN` | l'URL Vercel **exacte** (ex. `https://maysync.vercel.app`) — **sans** slash final |
   | `APP_WEB_URL` | la même URL Vercel (sert aux liens dans les emails) |

2. **Save Changes** → Render redéploie l'API automatiquement.
3. Ouvre ton URL Vercel → crée un compte candidat. Si l'inscription passe sans
   erreur CORS dans la console (F12), **c'est relié.** 🎉

> ⚠️ Mismatch d'URL (http vs https, slash final, sous-domaine différent) = cause
> n°1 des « ça marche en local mais pas en prod ». Copie-colle l'URL exacte.

---

## 4. Activer les services réels (recommandé) — 15 min

Par défaut tout le cœur fonctionne, **mais** : les emails ne partent pas (mode
log), l'upload CV/diplôme n'est pas persisté (stub), l'OCR est factice. Pour une
vraie prod, ajoute ces variables sur **Render → cobalt-api → Environment** :

### 4.a Emails réels (Brevo)
| Key | Value |
|---|---|
| `MAIL_DRIVER` | `smtp` |
| `SMTP_HOST` | `smtp-relay.brevo.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | ton login SMTP Brevo |
| `SMTP_PASSWORD` | ta **clé SMTP** Brevo (pas le mot de passe du compte) |
| `MAIL_FROM` | `MaySync <no-reply@ton-domaine>` |

> Dans Brevo : vérifie un domaine d'envoi + ajoute les enregistrements DNS SPF/DKIM,
> sinon les emails tombent en spam. Un `@gmail.com` en From sera rejeté.

### 4.b Stockage CV/diplômes (Cloudflare R2)
Dans Cloudflare → R2 → crée un bucket `maysync` + un token API (Access Key/Secret).
Puis **remplace** les valeurs démo par :
| Key | Value |
|---|---|
| `STORAGE_DRIVER` | `s3` |
| `STORAGE_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` |
| `STORAGE_ACCESS_KEY` | ta R2 Access Key |
| `STORAGE_SECRET_KEY` | ta R2 Secret Key |
| `STORAGE_BUCKET` | `maysync` |
| `STORAGE_REGION` | `auto` |
| `STORAGE_FORCE_PATH_STYLE` | `true` |

### 4.c OCR réel (aucun compte, gratuit)
| Key | Value |
|---|---|
| `OCR_DRIVER` | `real` |

### 4.d Paiements (Stripe — optionnel)
| Key | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` (puis `sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (endpoint `https://<api>/api/v1/webhooks/payment`) |

Après chaque ajout de variables → **Save Changes** (Render redéploie).

---

## 5. Vérification finale (5 min)

Sur ton URL Vercel :
1. **Inscription candidat** → l'email de vérification arrive (si §4.a fait) →
   clique le lien → « Email vérifié ».
2. **Connexion** → tableau de bord.
3. **Profil** → ajoute compétences + expérience → complétude monte.
4. Upload d'un **CV** (si §4.b fait) → re-télécharge-le pour vérifier la persistance.
5. Côté recruteur (compte provisionné par toi via `/admin`) → **CVthèque**,
   **messagerie**, **invitation d'un recruteur**.

---

## 6. Limites du gratuit (à savoir, normales)

- **Render web (gratuit)** : l'API **s'endort après 15 min** d'inactivité ; la
  1ʳᵉ requête ensuite met **~30–50 s** à réveiller (cold start). Normal.
- **PostgreSQL gratuit Render** : **expire après ~30 jours** → passe en payant
  (~7 $/mois) avant cette échéance si c'est de la vraie prod, sinon tu perds la
  base.
- **Vercel Hobby** : gratuit, parfait pour le front. (Usage commercial → plan Pro.)
- **Brevo** : 300 emails/jour gratuits. **R2** : 10 Go gratuits.

---

## 7. Dépannage rapide

| Symptôme | Cause probable | Fix |
|---|---|---|
| Erreur **CORS** dans la console | `CORS_ORIGIN` ≠ URL Vercel exacte | recopier l'URL (https, sans slash final) |
| Front charge mais toutes les requêtes échouent | `NEXT_PUBLIC_API_BASE_URL` faux | mettre l'URL Render **sans** `/api/v1`, puis **redeploy Vercel** |
| 1ʳᵉ requête très lente | cold start Render (gratuit) | normal ; attendre ~40 s |
| Emails non reçus | `MAIL_DRIVER` pas `smtp`, ou SPF/DKIM manquants | §4.a |
| Upload CV « disparaît » | `STORAGE_DRIVER` encore `stub` | §4.b (R2) |
| Build API échoue sur une migration | base pas prête | relancer le deploy Render (idempotent) |
| L'API ne démarre pas | une variable **obligatoire** manque | vérifier DB_*/REDIS_HOST/JWT_*/STORAGE_* dans l'onglet Environment |

---

## 8. Après le déploiement (bonnes pratiques)

- **Génère les comptes recruteurs** depuis `/admin` (ou une entreprise + son
  company-admin), puis le company-admin invite son équipe (flux d'invitation).
- **Variables secrètes** : ne jamais committer `.env`. Tout vit dans Render/Vercel.
- **Domaine perso** (optionnel) : rattache ton domaine sur Vercel (front) et, si
  besoin, un sous-domaine `api.` sur Render ; pense à mettre à jour `CORS_ORIGIN`
  et `APP_WEB_URL` en conséquence.
- **Renommage des ressources** : les ressources Render s'appellent `cobalt-*`
  (nom interne historique) ; c'est cosmétique et sans impact sur la marque
  MaySync affichée. Tu peux les renommer dans Render si tu veux.

Bon déploiement 🚀
