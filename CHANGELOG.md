# Cobalt — Journal des versions

## v1.0.0 — Première version complète (GA)

**Cobalt** est une plateforme de recrutement tech qui met en relation des
**candidats évalués et vérifiés** avec des **entreprises**, en mode SaaS à packs.
Son différenciateur : les recruteurs ne parcourent pas des CV bruts mais une
CVthèque de candidats **dont le profil est complet, l'école vérifiée et les
compétences mesurées par une évaluation**.

Cette version est **complète de bout en bout** (Frontend → API → Base de données),
multilingue (fr / en / ar, avec RTL), testée et packagée pour le déploiement.

### Fonctionnalités

**Socle — Packs, fonctionnalités & permissions**
- Système centralisé **PACK → FEATURES → PERMISSIONS** : chaque pack ouvre un
  ensemble de fonctionnalités et de quotas, appliqué **côté API** (impossible à
  contourner) et reflété dans l'interface.
- Packs : **Starter / Pro / Premium / Enterprise**, overrides administrables.

**Espace candidat**
- Profil complet (identité, école, compétences, expériences, projets, liens, CV),
  avec score de complétude.
- **Évaluations** QCM techniques + psychotechniques, **question par question
  avec chronomètre**, en **plein écran** sans distraction.
- Vérification d'école par **OCR réel** (diplôme), avec **auto-approbation** si la
  confiance OCR ≥ 92 %.
- Parcours d'offres d'emploi : recherche, détail, candidature, suivi.

**Espace recruteur / entreprise**
- **CVthèque** : recherche, tri et filtre par école ; ne remontent que les profils
  **complets (≥ 70 %) et évalués** → un vivier qualifié.
- **Offres d'emploi** : création, publication, clôture, gestion des candidatures.
- **Statistiques** sur données réelles (offres, candidatures, contacts, tendances).
- Abonnements rattachés à l'**entreprise** (pas au recruteur), quotas de contacts.

**Espace administrateur**
- Gestion des packs, vérification des écoles, modération, **analytics plateforme**
  (utilisateurs, entreprises, abonnements, offres, évaluations) sur données réelles.

**Crédibilité & anti-triche des évaluations**
- Banque de questions élargie et **tirage aléatoire** depuis de grands pools
  (mémorisation inefficace).
- **Chrono serveur strict** : une soumission hors délai est **invalidée**, pas notée.
- **Anti-triche** : au-delà d'un seuil de sorties de l'environnement sécurisé,
  la tentative est **automatiquement invalidée** (pas seulement signalée).

### Qualité
- **953 tests backend** + **101 tests frontend** au vert ; couverture au-dessus
  des seuils CI (70 / 50 / 70 / 70).
- Accessibilité **WCAG AA** (checklist + axe), emails HTML brandés, i18n à parité.

### Pile technique
- **Backend** : NestJS 11, PostgreSQL 16 (TypeORM, migrations additives), Redis/BullMQ.
- **Frontend** : Next.js 16 (build standalone), React 19, TanStack Query.
- **Infra** : Docker Compose, chart **Helm**, **Terraform**, OpenTelemetry.
- **Intégrations** : stockage objet S3-compatible, OCR (pdf-parse + tesseract),
  SMTP (envoi d'emails), paiements.

### Déployer / tester
- Démo one-VM : voir [`docs/DEMO-DEPLOY.md`](docs/DEMO-DEPLOY.md).
- Jeu de données de test reproductible : `npm run seed:testcases`
  (comptes dans [`docs/COMPTES_TEST.md`](docs/COMPTES_TEST.md)).
- Production : chart Helm + Terraform dans [`deploy/`](deploy/).

### Limites connues (transparence)
- L'anti-triche est **navigateur** (onglets, focus, plein écran) : dissuasif et
  invalidant, mais contournable avec un second appareil ; un proctoring **vidéo**
  tiers serait nécessaire pour un examen certifiant.
- La vérification d'école auto-approuve au-delà de 92 % de confiance OCR ; en
  dessous, revue manuelle.
- La valeur marchande dépend de l'**amorçage** du vivier (candidats ↔ recruteurs).
