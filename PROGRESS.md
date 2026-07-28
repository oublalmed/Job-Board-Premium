# PROGRESS — Job Board Premium

> **À lire en premier par toute session Claude Code.**
> Ce fichier est la source de vérité sur l'état d'avancement. Avant de coder quoi que ce soit :
> 1. Lis ce fichier en entier.
> 2. Lis `docs/CDC_JobBoard_Premium_V0.2.docx` (spécifications) et `docs/Backlog_UserStories_V0.2.docx` (user stories).
> 3. Identifie le **prochain lot / la prochaine story « à faire »** ci-dessous.
> 4. Respecte les dépendances : ne démarre un lot que si ses dépendances sont « Terminé ».
> 5. À la fin de ton travail, **mets ce fichier à jour** (statut, date, notes) et commit-le.

---

## Décisions produit validées (figées — à mettre en config, jamais en dur)

- Modèle candidat : **freemium, gratuit au MVP**.
- Seuil complétude "profil publiable" : **70 %**.
- Seuil indexation CVthèque : **score ≥ 40 OU percentile ≥ P30**.
- Seuil mise en avant : **percentile ≥ P75**.
- Pricing recruteur : **990 / 2900 / 6900 MAD HT** ; quotas **15 / 60 / 200** contacts/mois.
- Devise **MAD** ; bilingue **FR + AR (RTL)** ; fuseau **Africa/Casablanca**.
- Hébergement : **hébergeur local marocain** (CNDP).
- Équipe : **5** (1 lead/archi, 2 back, 1 front, 1 QA-BA).
- Scoring & PSP : **fournisseur non figé** → toujours via un PORT + stub. Choix réel au moment de brancher l'adaptateur (scoring = Lot 2, PSP = Lot 6).

---

## Conventions (à respecter à chaque lot)

- **Ports & Adapters** pour toute dépendance externe (scoring, PSP, mail, antivirus, stockage). Le domaine ne dépend jamais directement d'un fournisseur.
- **RBAC** vérifié côté serveur à chaque requête. Rôles : candidate, recruiter, company_admin, moderator, admin (cumulables).
- **Aucune donnée personnelle dans les logs.** Secrets via env, jamais commités.
- **Tout seuil / quota / règle chiffrée est configurable** (env + table `settings`), cf. EF-ADM-02.
- **TypeScript strict**, pas de `any` implicite. Validation d'entrée (DTO) systématique.
- **Definition of Done d'une story** = chaque scénario Given/When/Then a un test vert · validation d'entrée · gestion d'erreurs · pas de secret/donnée perso en logs · revue passée. Vise ≥ 70 % de couverture (ENF-10).
- Commits atomiques, conventional commits.

---

## Suivi des lots

Légende statut : ⬜ À faire · 🟨 En cours · ✅ Terminé · ⏸️ Bloqué

| Lot | Contenu | Dépendances | Statut | Dernière MAJ | Notes |
|---|---|---|---|---|---|
| **Lot 0** | Socle : infra, CI/CD, auth JWT, RBAC, modèle de données, ports+stubs, audit, event-tracking KPI, docker-compose | — | ✅ Terminé | 2026-07-28 | 7 commits, 66 tests, 89% coverage |
| **Lot 1** | Module candidat (profil, CV, liens, complétude 70 %) | Lot 0 | ✅ Terminé | 2026-07-28 | 4 stories, 116 tests, 15 suites |
| **Lot 2** | Évaluation & scoring (adaptateur API réel + webhook + anti-triche + barème) | Lot 0, 1 | ✅ Terminé | 2026-07-28 | 3 stories, 209 tests (22 suites). Fournisseur non choisi → port + stub mock. Anti-triche socle, score webhook idempotent, seuils indexation/featuring configurables. |
| **Lot 3** | CVthèque & recherche (indexation selon seuils) | Lot 1, 2 | ✅ Terminé | 2026-07-28 | US-SRCH-02 + fix EF-SRCH-01. 236 tests (24 suites), 92.7% coverage. FTS Postgres via QueryBuilder (sans GIN, sans migration). |
| **Lot 4** | Espace recruteur & offres | Lot 0, 3 | ⬜ À faire | — | |
| **Lot 5** | Messagerie (socle) + quotas de contacts | Lot 1, 4 | ⬜ À faire | — | Décrément quota à l'ouverture du fil |
| **Lot 6** | Abonnement & facturation (PSP, paliers, dunning) | Lot 4 | ⬜ À faire | — | ⚠️ Confirmer le PSP (compatible Maroc, ICE/TVA) ici |
| **Lot 7** | Remédiation candidat + Amorçage (badge partageable, referral, essai recruteur) | Lot 2, 4 | ⬜ À faire | — | |
| **Lot 8** | Admin, modération, RGPD/CNDP | Transverse | ⬜ À faire | — | |
| **Lot 9** | Durcissement, recette, ENF, sécurité, i18n FR/AR | Tous | ⬜ À faire | — | |

---

## Détail du Lot 0 — Socle technique (✅ Terminé)

Périmètre précis :

- [x] Squelette NestJS modulaire + config typée + validation des variables d'env au démarrage
- [x] Connexion PostgreSQL (TypeORM Data Mapper) + datasource CLI migrations
- [x] Schéma initial : User, CandidateProfile, Company, Recruiter, Subscription, Specialty, Test, Assessment, Score, Skill/ProfileSkill, Document, AuditLog
- [x] Auth : inscription + vérif email (stub mail), login JWT (access+refresh), politique MDP OWASP, hash Argon2id
- [x] RBAC : décorateur + guard de permissions réutilisable, testé (5 rôles cumulatifs)
- [x] 5 ports + stubs : ScoringProvider, PaymentProvider, MailProvider, FileScanner, ObjectStorage
- [x] Audit : intercepteur traçant les actions sensibles (AuditLog)
- [x] Observabilité : logger structuré, health-check Terminus
- [x] docker-compose (api + postgres + redis + minio) démarrable en une commande
- [x] CI GitHub Actions : install, lint, test, build
- [x] README : prérequis, démarrage local, structure, conventions

---

## Détail du Lot 1 — Module candidat (✅ Terminé)

Stories dans l'ordre :

- [x] `US-CAND-01` — inscription + vérification email (couvert par Lot 0 + tests DTO ajoutés)
- [x] `US-CAND-02` — profil + calcul de complétude (seuil 70 %, barème pondéré CDC §5.1)
- [x] `US-CAND-03` — upload CV (FileScanner + ObjectStorage, PDF/DOCX <= 5 Mo)
- [x] `US-CAND-08` — export / suppression des données (droits CNDP/RGPD)

---

## Prochaines stories (après Lot 3) — ordre recommandé

1. Lot 4 — Espace recruteur & offres : onboarding recruteur (compte entreprise KYB léger, `Company`/`Recruiter`/`Subscription` peuplés via de vrais endpoints — jusqu'ici seedés manuellement pour les tests), publication d'offres, EF-RECR-01→06.

Pour chaque story : ses critères Given/When/Then du backlog = la Definition of Done. Rester dans le périmètre de la story, ne pas déborder.

---

## Journal (à compléter par chaque session)

| Date | Session | Ce qui a été fait | Prochaine étape |
|---|---|---|---|
| — | — | Initialisation du repo et des specs | Démarrer Lot 0 |
| 2026-07-28 | Session 1 | Lot 0 complet : NestJS strict, TypeORM Data Mapper, auth JWT+refresh rotation, RBAC 5 rôles cumulatifs, 5 ports+stubs, audit, settings configurable, health check, Docker, CI. 7 commits, 66 tests (10 suites), 89% coverage. | Lot 1 : US-CAND-01 |
| 2026-07-28 | Session 2 | US-CAND-01 confirmée (couverte par Lot 0 + tests DTO). US-CAND-02 : profil candidat (service + controller + DTOs), calcul complétude pondéré (7 critères CDC §5.1, poids en settings), entités Experience + ProfileLink, firstName/lastName sur profil. 22 tests ajoutés (95 total). | US-CAND-03 |
| 2026-07-28 | Session 3 | US-CAND-03 : upload CV (POST/GET/DELETE /candidates/cv). Pipeline : validation type (PDF/DOCX) + taille (≤5 Mo configurable) → scan FileScanner (bloquant) → stockage ObjectStorage → Document entity → recalcul complétude. Refactoré ports en @Global PortsModule. US-CAND-08 : export données (JSON portable, sans hash/tokens) + suppression/anonymisation (soft-delete user, suppression profil+docs+storage, email anonymisé). Résilience si storage indispo. Audit journalisé. Recette Lot 1 : ajout tests controllers (isolation user.sub, pas d'accès croisé), tests getCV/deleteCV, couverture 100% stmts/funcs/lines sur les 4 fichiers candidat. 132 tests, 17 suites. Lot 1 validé ✅. | Lot 2 |
| 2026-07-28 | Session 4 | US-EVAL-02 : passage de test en environnement sécurisé. Anti-triche socle : session unique, timer strict (expiresAt depuis durationMinutes), cooldown 90j configurable (settings `assessment_cooldown_days`), gestion d'incident (resumeToken UUID, reprise sans consommer de tentative). Enrichi Assessment (resumeToken, expiresAt), Score (testVersion, plagiarismVerdict), ScoringProvider port (verifyWebhookSignature, plagiarism). Controller : POST start/resume/incident, RBAC CANDIDATE. 32 tests ajoutés (164 total, 19 suites). US-EVAL-03 : score normalisé 0-100 via webhook. WebhookService : vérification signature, normalisation score, persistance Score (baremeVersion, testVersion, plagiarismVerdict), idempotence (replay safe). WebhookController : POST /assessments/webhook (pas de JWT, signature header). Settings : `score_bareme_version`, `score_validity_days`. 27 tests ajoutés (191 total, 21 suites). US-EVAL-SEUIL : seuils d'indexation et featuring. IndexationService (applyThresholds) : score ≥ 40 OU percentile ≥ P30 → indexedInCvtheque, percentile ≥ P75 → featured. Exclut scores expirés et plagiat confirmé. Seuils configurables via settings. CandidateProfile enrichi (indexedInCvtheque, featured). Câblé dans WebhookService après persistance du score. 18 tests ajoutés (209 total, 22 suites). Lot 2 terminé ✅. | Lot 3 |
| 2026-07-28 | Session 5 | Environnement local sans Docker (Postgres natif, `DB_SYNCHRONIZE=true` en dev faute de migrations). Fix bug bloquant : 21 colonnes `string \| null` sans `type` explicite plantaient TypeORM sur Postgres (`DataTypeNotSupportedError`) — ajout de `type: 'varchar'` partout où c'était manquant. Lot 3 — CVthèque & recherche : fix EF-SRCH-01 (IndexationService n'appliquait pas le seuil de complétude ≥70 % — corrigé, `featured` dépend désormais de `indexedInCvtheque`). Ajout champ `location` sur CandidateProfile (gap CDC EF-SRCH-02 vs modèle Lot 1). Nouveau module `search` : `GET /api/v1/search/candidates` (US-SRCH-02) — filtres combinables (q full-text, skills, scoreMin, availability, mobility, location, salaire), tri par meilleur score valide, pagination curseur (keyset base64), RBAC (recruiter/company_admin/admin), gate abonnement actif contre `Recruiter`/`Subscription` (entités du schéma Lot 0, pas encore peuplées par un vrai flux d'onboarding — Lot 4). Première utilisation de `createQueryBuilder`/FTS Postgres (`to_tsvector`/`plainto_tsquery`, sans index GIN — tech debt documentée). 44 tests ajoutés (236 total, 24 suites), 92.7% coverage. Lot 3 terminé ✅. | Lot 4 |

---

## Détail du Lot 3 — CVthèque & recherche (✅ Terminé)

Stories dans l'ordre :

- [x] `EF-SRCH-01` (fix) — indexation conditionnée à complétude ≥ 70 % ET score obtenu (gap trouvé dans `IndexationService` du Lot 2, corrigé)
- [x] `US-SRCH-02` — recherche recruteur avec filtres combinables, respect de la visibilité, accès conditionné à un abonnement actif

Hors périmètre (reporté, cf. CDC) : `EF-SRCH-04` (alertes sauvegardées, Should), `EF-SRCH-05` (anonymisation aperçu, Could — non tranché métier), onboarding recruteur complet (Lot 4), OpenSearch (V1).

---

## Décisions techniques Lot 3

- **Fix indexation (EF-SRCH-01)** : `IndexationService.applyThresholds` ne vérifiait que le score/percentile, jamais la complétude. Corrigé : `indexedInCvtheque = completeness >= completeness_threshold_publishable ET (score >= seuil OU percentile >= seuil)`. `featured` dépend maintenant de `indexedInCvtheque` (un profil non indexé ne peut pas être mis en avant).
- **Champ `location`** : absent du modèle Lot 1 alors qu'EF-SRCH-02 le liste comme filtre — ajouté sur `CandidateProfile` (simple `varchar` nullable, ne compte pas dans le barème de complétude §5.1 du CDC).
- **Full-text search sans migration** : `to_tsvector('french', headline || bio)` / `plainto_tsquery` calculés à la volée via `QueryBuilder` (pas de colonne `tsvector` persistée, pas d'index GIN). Première utilisation de `createQueryBuilder` dans le repo. **Limite connue** : sans index GIN, ne passera pas à l'échelle — chemin de migration vers OpenSearch déjà prévu par le CDC en V1.
- **Score affiché/filtré** : meilleur score valide (non expiré, `plagiarismVerdict != confirmed`) par candidat, via sous-requête `GROUP BY MAX(value)`/`MAX(percentile)` — simplification MVP (percentile pris indépendamment du score max plutôt que via une jointure exacte sur la même ligne).
- **Pagination curseur** : keyset sur `(bestScore DESC, profile.id DESC)`, curseur = base64 opaque. Première implémentation de ce pattern (le `PaginationDto` offset-based existant reste inutilisé).
- **Gate abonnement actif** : implémenté contre les entités `Recruiter`/`Subscription` déjà présentes dans le schéma (Lot 0), bien qu'aucun flux d'onboarding recruteur (Lot 4/6) n'existe encore pour les peupler — à seeder manuellement (SQL ou futurs endpoints Lot 4) jusque-là. Les admins bypassent ce gate.
- **Salaire** : `salaryMin`/`salaryMax` inclus dans la réponse recherche uniquement si `salaryVisible = true` sur le profil.

---

## Détail du Lot 2 — Évaluation & scoring (✅ Terminé)

Stories dans l'ordre :

- [x] `US-EVAL-02` — passage du test en environnement sécurisé (anti-triche socle : session unique, timer strict, cooldown 90j configurable, incident management avec resumeToken)
- [x] `US-EVAL-03` — score normalisé 0-100 + percentile via webhook (idempotent, signature verification, barème/testVersion historisés)
- [x] `US-EVAL-SEUIL` — application des seuils d'indexation et de mise en avant (score ≥ 40 OU percentile ≥ P30 → indexation, percentile ≥ P75 → featuring, seuils configurables)

---

## Décisions techniques Lot 2

- **Fournisseur scoring** : non choisi. Code contre le port `ScoringProvider` avec stub mock. Le vrai fournisseur (Codility/HackerRank) sera branché via un nouvel adaptateur sans toucher au domaine.
- **Anti-triche MVP** : socle (timer strict, session unique, 1 tentative/90j/test, cooldown affiché) + détection plagiat exposée comme capacité du port. **Signaux comportementaux (frappe/temps) reportés en V1.**
- **Cooldown** : configurable via `assessment_cooldown_days` (settings table, fallback = 90).
- **Incident management** : `resumeToken` (UUID) régénéré à chaque reprise. Reprise ne consomme pas de tentative, ne crée pas de nouvelle session ScoringProvider.
- **Score entity enrichi** : `testVersion` (audit reproductibilité) + `plagiarismVerdict` (enum clean/suspected/confirmed).
- **Webhook scoring** : idempotent (vérifie existence Score avant traitement), signature vérifiée via `ScoringProvider.verifyWebhookSignature()`. Score normalisé à 0-100 (score/maxScore*100). Pas de JWT, authentification par signature header `x-scoring-signature`.
- **Barème et version de test** : figés par Score au moment du calcul (`baremeVersion` depuis settings `score_bareme_version`, `testVersion` depuis Test entity). Reproductibilité audit garantie.
- **Validité du score** : configurable via `score_validity_days` (settings table, fallback = 365 jours).

---

## Décisions techniques Lot 1

- **Effacement CNDP/RGPD** : suppression immédiate (conforme « sous 30 j »). Fenêtre de grâce (soft-delete différé + scheduler) reportée en V1 si besoin métier.
- **`completeness_min_skills`** : clé settings déjà lue depuis la table settings (fallback = 5 si absent en DB). Cohérente avec le nommage `completeness_*`.

---

## Garde-fous permanents

- **Ne pas démarrer un lot dont les dépendances ne sont pas ✅.**
- **DPIA / démarche CNDP** : administrative, à mener en parallèle dès le Lot 0 (hors code, mais conditionne la mise en prod).
- Ne jamais inventer une valeur métier non tranchée : la marquer TODO/config et le signaler dans le journal.
