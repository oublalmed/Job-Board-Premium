# Déployer une démo client (VM + Docker Compose + tunnel)

Objectif : ton collègue lance le stack complet sur **un seul VM**, et partage
**une seule URL** (fournie par un tunnel, aucun nom de domaine requis) au client.

Tout passe par un reverse-proxy **same-origin** : `/` → frontend, `/api/*` →
API. Le navigateur appelle l'API sur la même origine → **pas de CORS**, aucune
URL publique à coder en dur.

```
Internet ──(tunnel HTTPS)──> Caddy :80 ──┬── /        → frontend (Next.js)
                                          └── /api/*   → api (NestJS)
                                                          ├── Postgres
                                                          ├── Redis
                                                          └── MinIO (stockage)
```

## 1. Prérequis (sur le VM)

- Linux avec **Docker** + **Docker Compose v2** (`docker compose version`).
- ~**4 Go de RAM**, 2 vCPU, ~10 Go disque.
- Sortie Internet (pour le build des images et le tunnel).

## 2. Récupérer le code + configurer les secrets

```bash
git clone <URL_DU_REPO> cobalt && cd cobalt
git checkout claude/frontend-nextjs-redesign-1114aa   # ou la branche voulue

cp .env.demo.example .env.demo
# Édite .env.demo : mets de vrais secrets (JWT >= 16 caractères), mots de passe DB/MinIO.
nano .env.demo
```

## 3. Démarrer le stack

```bash
docker compose --env-file .env.demo -f docker-compose.demo.yml up -d --build
```

Au premier démarrage, le service **`init`** joue les migrations puis charge le
jeu de démo (`seed:testcases`). Suivre son avancement :

```bash
docker compose -f docker-compose.demo.yml logs -f init      # attendre "Test fixtures created"
docker compose -f docker-compose.demo.yml ps                # api doit être "healthy"
```

Vérifier en local sur le VM :

```bash
curl -s localhost:8080/api/v1/health     # -> 200
curl -s -o /dev/null -w '%{http_code}\n' localhost:8080   # -> 200 (frontend)
```

## 4. Exposer une URL publique (tunnel, sans domaine)

### Option A — Cloudflare Tunnel (sans compte, inclus dans le compose)

```bash
docker compose --env-file .env.demo -f docker-compose.demo.yml --profile tunnel up -d
docker compose -f docker-compose.demo.yml logs cloudflared | grep trycloudflare
```

Copie l'URL `https://xxxxx.trycloudflare.com` : c'est **le lien à donner** au
collègue / client. (URL éphémère, régénérée à chaque redémarrage — parfait pour
une démo ponctuelle.)

### Option B — ngrok

```bash
ngrok http 8080     # partage l'URL https://xxxx.ngrok.app affichée
```

### Option C — IP publique directe

Si le VM a une IP publique et que le port est ouvert : `http://IP_DU_VM:8080`
(pas de HTTPS → moins rassurant pour un client externe ; préférer le tunnel).

## 5. Donner les accès au collègue

- **URL** : le lien du tunnel (étape 4).
- **Comptes** : voir [`COMPTES_TEST.md`](COMPTES_TEST.md) — mot de passe commun
  `Password123!`, 1 admin, 3 recruteurs (Starter/Pro/Premium), 3 candidats,
  offres + candidatures déjà en place.
- **Mailpit** (emails de la démo, ex. inscriptions live) : `http://IP_DU_VM:8025`.

Scénarios de démo prêts : connexion recruteur **Premium** (`recruteur.premium@test.cobalt.ma`)
→ Jobs, candidatures, anti-triche, statistiques ; connexion **admin** → analytics
plateforme ; connexion candidat → parcours d'offres + candidature.

## 6. Réinitialiser les données (entre deux démos)

```bash
docker compose --env-file .env.demo -f docker-compose.demo.yml run --rm init \
  sh -c "npm run seed:testcases"
```

## 7. Tout arrêter / supprimer

```bash
docker compose -f docker-compose.demo.yml down            # arrêt (garde les données)
docker compose -f docker-compose.demo.yml down -v         # + supprime les volumes (base, stockage)
```

## Sécurité — à lire avant d'exposer

- C'est un environnement **jetable de démo** : mots de passe communs
  (`Password123!`) et CORS ouvert. **Ne pas** y mettre de données réelles/clients.
- Mets tout de même de **vrais secrets** dans `.env.demo` (JWT, DB, MinIO).
- Le tunnel rend l'app **publique sur Internet** le temps de la démo :
  **coupe-le** dès la démo finie (`down`), et régénère une URL au besoin.
- Pour un environnement durable/pro, utiliser plutôt le chart **Helm**
  (`deploy/helm/cobalt`) + Terraform (`deploy/terraform`).

## Dépannage

| Symptôme | Piste |
|---|---|
| `api` reste `unhealthy` | `docker compose -f docker-compose.demo.yml logs api` — souvent une variable requise manquante (`.env.demo`). |
| `init` échoue | Vérifier que Postgres est `healthy` ; relire les logs `init` (migrations). |
| Page blanche / 404 sur `/api` | Vérifier le `Caddyfile` monté et que `api` tourne. |
| Upload de CV échoue | Le bucket MinIO n'est pas créé → relancer `minio-init`. |
| OCR ne détecte pas l'école | `OCR_DRIVER=real` télécharge les données tesseract au 1er usage (Internet requis) ; sinon les écoles du seed restent visibles. |
