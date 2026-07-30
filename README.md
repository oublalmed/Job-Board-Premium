# Job Board Premium

Plateforme de recrutement tech pour le marche marocain. Monolithe modulaire NestJS avec architecture hexagonale.

## Prerequis

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15 (via docker-compose)
- Redis 7 (via docker-compose)

## Demarrage local

```bash
# 1. Cloner et installer
git clone <repo-url>
cd Job-Board-Premium
npm install

# 2. Configurer l'environnement
cp .env.example .env
# Editer .env avec vos valeurs (secrets JWT, connexion DB, etc.)

# 3. Lancer l'infrastructure (PostgreSQL, Redis, MinIO)
docker-compose up -d postgres redis minio

# 4. Lancer les migrations (obligatoire avant le premier demarrage)
# DB_SYNCHRONIZE=false par defaut (voir docs/adr/0002-schema-migration-governance.md) :
# le schema n'est plus cree automatiquement au demarrage. Sur une base vierge,
# sauter cette etape fait planter l'app (aucune table).
npm run migration:run

# 5. Demarrer en dev
npm run start:dev
```

L'API est disponible sur `http://localhost:3000/api` (prefix configurable via `APP_API_PREFIX`).

### Docker (tout-en-un)

```bash
docker-compose up --build
```

> **Non fonctionnel sur un volume Postgres vierge à ce jour** : le service `api` tourne avec `DB_SYNCHRONIZE=false` mais aucune étape du build/démarrage n'exécute `migration:run`, et l'image de production actuelle (`npm ci --omit=dev`) n'embarque pas `ts-node`/`tsconfig-paths`, dont ce script dépend. À corriger avant de dépendre de ce chemin (migrations à exécuter contre le `data-source` compilé dans `dist/`, sans `ts-node`) — voir `docs/adr/0002-schema-migration-governance.md`. En attendant, préférez le démarrage local ci-dessus.

## Scripts

| Commande | Description |
|---|---|
| `npm run start:dev` | Dev avec hot-reload |
| `npm run build` | Compilation TypeScript |
| `npm run lint` | ESLint (avec auto-fix) |
| `npm run test` | Tests unitaires |
| `npm run test:cov` | Tests avec couverture |
| `npm run migration:generate` | Generer une migration |
| `npm run migration:run` | Executer les migrations |

## Structure du projet

```
src/
  config/              # Configuration typee (app, auth, db, redis, storage, business)
  common/
    decorators/         # @Roles(), @CurrentUser(), @Audit()
    guards/             # JwtAuthGuard, RolesGuard (RBAC)
    filters/            # GlobalExceptionFilter
    interceptors/       # AuditLogInterceptor
    enums/              # Role, AuditAction
    dto/                # PaginationDto reutilisable
    interfaces/         # JwtPayload, RequestWithUser
  ports/                # Interfaces hexagonales (scoring, payment, mail, file-scanner, object-storage)
  adapters/             # Implementations stub (Lot 0) des ports
  modules/
    auth/               # Inscription, login, JWT, refresh token rotation, verification email
    users/              # Entite User, CRUD
    candidates/         # Entites profil candidat, competences, documents
    companies/          # Entites entreprise, recruteur, abonnement
    assessments/        # Entites specialite, test, assessment, score
    audit/              # Journal d'audit (global)
    settings/           # Configuration dynamique DB avec fallback env
    health/             # Health check (Terminus)
  database/
    data-source.ts      # DataSource TypeORM pour CLI migrations
```

## Architecture

### Roles RBAC

5 roles cumulatifs : `candidate` < `recruiter` < `company_admin` < `moderator` < `admin`. Un admin a implicitement tous les droits des roles inferieurs.

### Ports & Adapters

Toute dependance externe passe par un port (interface TypeScript + symbole d'injection). Au Lot 0, chaque port a un adaptateur stub :

| Port | Responsabilite | Adaptateur Lot 0 |
|---|---|---|
| `ScoringProvider` | Tests techniques candidats | Stub (score fixe 65/100) |
| `PaymentProvider` | Checkout, webhooks PSP | Stub (toujours succes) |
| `MailProvider` | Envoi emails transactionnels | Stub (stockage memoire) |
| `FileScanner` | Analyse antivirus fichiers | Stub (toujours clean) |
| `ObjectStorage` | Stockage fichiers (S3) | Stub (Map en memoire) |

### Configuration

Tous les seuils, quotas et tarifs sont configurables via :
1. Variables d'environnement (`.env`)
2. Table `settings` en base (prioritaire sur env)

Aucune valeur metier n'est codee en dur.

### Securite

- Mots de passe : Argon2id (recommandation OWASP)
- JWT access token (courte duree) + refresh token opaque (rotation avec detection de reutilisation)
- Validation stricte des entrees (`class-validator`, `whitelist: true`, `forbidNonWhitelisted: true`)
- Helmet pour les headers HTTP
- RBAC verifie cote serveur a chaque requete
- Aucune donnee personnelle dans les logs

## Conventions

- **Commits** : Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- **TypeScript** : Mode strict, Data Mapper pattern (TypeORM)
- **Tests** : Jest, objectif >= 70% de couverture
- **Langue du code** : Anglais (commentaires et noms)
- **Contexte metier** : Devise MAD, fuseau Africa/Casablanca, bilingue FR/AR

## Endpoints (Lot 0)

| Methode | Route | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Inscription | Non |
| POST | `/api/auth/verify-email` | Verification email | Non |
| POST | `/api/auth/login` | Connexion | Non |
| POST | `/api/auth/refresh` | Rafraichir les tokens | Non |
| GET | `/api/auth/me` | Profil utilisateur connecte | JWT |
| GET | `/health` | Health check | Non |

## CI

GitHub Actions : lint + tests avec couverture + build. Voir `.github/workflows/ci.yml`.
