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
| **Lot 2** | Évaluation & scoring (adaptateur API réel + webhook + anti-triche + barème) | Lot 0, 1 | ✅ Terminé | 2026-07-28 | 3 stories, 244 tests (25 suites) + 5 tests e2e. Fournisseur non choisi → port + stub mock. Anti-triche socle, score webhook idempotent + **authentifié (HMAC-SHA256, fail-closed)**, seuils indexation/featuring configurables. Webhook durci en recette (voir Décisions techniques Lot 2 — durcissement). |
| **Lot 3** | CVthèque & recherche (indexation selon seuils) | Lot 1, 2 | ✅ Terminé | 2026-07-28 | US-SRCH-02 + fix EF-SRCH-01. 236 tests (24 suites), 92.7% coverage. FTS Postgres via QueryBuilder (sans GIN, sans migration). |
| **Lot 4** | Espace recruteur & offres | Lot 0, 3 | ✅ Terminé | 2026-07-28 | EF-RECR-01/02/03/06. Backlog livré ne détaillait pas l'Épic recruteur → Given/When/Then dérivés du CDC §4.5, validés story par story. 331 tests (304 unit / 34 suites + 27 e2e / 6 suites), toujours verts. Le gate d'abonnement du Lot 3 est désormais testable de bout en bout sans seed SQL (créer entreprise → recruiter → trial → `/search/candidates`). |
| **Lot 5** | Messagerie (socle) + quotas de contacts | Lot 1, 4 | ✅ Terminé | 2026-07-30 | 5A : `ContactQuotaService.consumeOneContact()` derrière `ContactQuotaPort`, décrément atomique, prouvé par e2e de concurrence. 5B : `Conversation`/`Message` (première vraie migration du repo), `ConversationService.openConversation` transactionnel (décrément + insertions dans une seule `dataSource.transaction()`, idempotence via contrainte `UNIQUE (candidate_id, company_id)`, pas de check-then-act). Voir Décisions techniques Lot 5. |
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

## Prochaines stories (après Lot 4) — ordre recommandé

1. Lot 5 — Messagerie (socle) + quotas de contacts : `EF-MSG-01/02/05`, `US-RECR-05` (le seul du backlog Épic recruteur détaillé en Given/When/Then — quota décrémenté à l'ouverture du fil, pas par message).

**Rappel Lot 4** : le backlog livré ne détaillait pas l'Épic recruteur en Given/When/Then (seul `US-RECR-05` y figurait, réservé au Lot 5). Les critères d'acceptation de EF-RECR-01/02/03/06 ont été **dérivés du CDC §4.5** et validés avec l'utilisateur story par story avant implémentation.

Pour chaque story : ses critères Given/When/Then (backlog si disponible, sinon dérivés du CDC et validés) = la Definition of Done. Rester dans le périmètre de la story, ne pas déborder.

---

## Journal (à compléter par chaque session)

| Date | Session | Ce qui a été fait | Prochaine étape |
|---|---|---|---|
| — | — | Initialisation du repo et des specs | Démarrer Lot 0 |
| 2026-07-28 | Session 1 | Lot 0 complet : NestJS strict, TypeORM Data Mapper, auth JWT+refresh rotation, RBAC 5 rôles cumulatifs, 5 ports+stubs, audit, settings configurable, health check, Docker, CI. 7 commits, 66 tests (10 suites), 89% coverage. | Lot 1 : US-CAND-01 |
| 2026-07-28 | Session 2 | US-CAND-01 confirmée (couverte par Lot 0 + tests DTO). US-CAND-02 : profil candidat (service + controller + DTOs), calcul complétude pondéré (7 critères CDC §5.1, poids en settings), entités Experience + ProfileLink, firstName/lastName sur profil. 22 tests ajoutés (95 total). | US-CAND-03 |
| 2026-07-28 | Session 3 | US-CAND-03 : upload CV (POST/GET/DELETE /candidates/cv). Pipeline : validation type (PDF/DOCX) + taille (≤5 Mo configurable) → scan FileScanner (bloquant) → stockage ObjectStorage → Document entity → recalcul complétude. Refactoré ports en @Global PortsModule. US-CAND-08 : export données (JSON portable, sans hash/tokens) + suppression/anonymisation (soft-delete user, suppression profil+docs+storage, email anonymisé). Résilience si storage indispo. Audit journalisé. Recette Lot 1 : ajout tests controllers (isolation user.sub, pas d'accès croisé), tests getCV/deleteCV, couverture 100% stmts/funcs/lines sur les 4 fichiers candidat. 132 tests, 17 suites. Lot 1 validé ✅. | Lot 2 |
| 2026-07-28 | Session 4 | US-EVAL-02 : passage de test en environnement sécurisé. Anti-triche socle : session unique, timer strict (expiresAt depuis durationMinutes), cooldown 90j configurable (settings `assessment_cooldown_days`), gestion d'incident (resumeToken UUID, reprise sans consommer de tentative). Enrichi Assessment (resumeToken, expiresAt), Score (testVersion, plagiarismVerdict), ScoringProvider port (verifyWebhookSignature, plagiarism). Controller : POST start/resume/incident, RBAC CANDIDATE. 32 tests ajoutés (164 total, 19 suites). US-EVAL-03 : score normalisé 0-100 via webhook. WebhookService : vérification signature, normalisation score, persistance Score (baremeVersion, testVersion, plagiarismVerdict), idempotence (replay safe). WebhookController : POST /assessments/webhook (pas de JWT, signature header). Settings : `score_bareme_version`, `score_validity_days`. 27 tests ajoutés (191 total, 21 suites). US-EVAL-SEUIL : seuils d'indexation et featuring. IndexationService (applyThresholds) : score ≥ 40 OU percentile ≥ P30 → indexedInCvtheque, percentile ≥ P75 → featured. Exclut scores expirés et plagiat confirmé. Seuils configurables via settings. CandidateProfile enrichi (indexedInCvtheque, featured). Câblé dans WebhookService après persistance du score. 18 tests ajoutés (209 total, 22 suites). Lot 2 terminé ✅. | Lot 3 |
| 2026-07-28 | Session 5 | Environnement local sans Docker (Postgres natif, `DB_SYNCHRONIZE=true` en dev faute de migrations). Fix bug bloquant : 21 colonnes `string \| null` sans `type` explicite plantaient TypeORM sur Postgres (`DataTypeNotSupportedError`) — ajout de `type: 'varchar'` partout où c'était manquant. Lot 3 — CVthèque & recherche : fix EF-SRCH-01 (IndexationService n'appliquait pas le seuil de complétude ≥70 % — corrigé, `featured` dépend désormais de `indexedInCvtheque`). Ajout champ `location` sur CandidateProfile (gap CDC EF-SRCH-02 vs modèle Lot 1). Nouveau module `search` : `GET /api/v1/search/candidates` (US-SRCH-02) — filtres combinables (q full-text, skills, scoreMin, availability, mobility, location, salaire), tri par meilleur score valide, pagination curseur (keyset base64), RBAC (recruiter/company_admin/admin), gate abonnement actif contre `Recruiter`/`Subscription` (entités du schéma Lot 0, pas encore peuplées par un vrai flux d'onboarding — Lot 4). Première utilisation de `createQueryBuilder`/FTS Postgres (`to_tsvector`/`plainto_tsquery`, sans index GIN — tech debt documentée). 44 tests ajoutés (236 total, 24 suites), 92.7% coverage. Lot 3 terminé ✅. | Recette Lot 2 |
| 2026-07-28 | Session 6 | Recette Lot 2 demandée avant Lot 4. Audit code réel du webhook (idempotence : OK ; anti-triche : OK ; **authenticité : absente** — `verifyWebhookSignature` du stub acceptait tout sans lire payload/signature ; raw body jamais capturé, `@Req() rawBody: Buffer` recevait en fait l'objet `Request` d'Express). Corrections : `rawBody: true` dans `main.ts` + controller typé `RawBodyRequest<Request>` (rejet 400 si absent) ; HMAC-SHA256 réel dans `StubScoringAdapter.verifyWebhookSignature` (secret `SCORING_WEBHOOK_SECRET`, comparaison timing-safe, **fail-closed** si secret absent, externalId extrait après vérification) ; tests de rejet réels (pas de mock) sur la fonction de vérification elle-même : sans signature, mauvaise signature, payload altéré, secret absent, longueur de signature différente, bonne signature. Ajout d'un test e2e (`test/webhook.e2e-spec.ts`, 4 scénarios contre app + Postgres réels) qui a révélé que `test/jest-e2e.json` n'avait jamais eu le `moduleNameMapper` requis — `test:e2e` n'avait probablement jamais tourné avec succès ; corrigé et câblé dans la CI. `test/app.e2e-spec.ts` (boilerplate testant une route `/` inexistante) remplacé par un smoke test réel sur `/health`. 8 tests ajoutés (244 total, 25 suites) + 5 tests e2e (2 suites). Lot 2 durci et validé ✅. | Lot 4 |
| 2026-07-28 | Session 7 | Lot 4 démarré. Backlog livré sans Given/When/Then pour l'Épic recruteur → scénarios dérivés du CDC §4.5, validés avec l'utilisateur avant code (convention adoptée pour tout le lot). `EF-RECR-01` : `POST /companies` (tout utilisateur authentifié email-vérifié) crée `Company` (ICE 15 chiffres validé + unique en DB) + `Recruiter` liant l'appelant + promotion `Role.COMPANY_ADMIN` (dédupliquée) + `Subscription` trial auto-provisionnée (`plan=starter`, `contactQuota` lu via settings `plan_starter_contacts`/env `PLAN_STARTER_CONTACTS`, **`endsAt` = createdAt + `trial_duration_days`** lu via settings/env `TRIAL_DURATION_DAYS`, fallback 14j — jamais illimité). `GET /companies/me` (404 propre si aucune entreprise, pas de crash). En écrivant l'e2e complet (créer entreprise → recruiter → trial → `/search/candidates`), **2 bugs réels du Lot 3 découverts et corrigés** dans `SearchService` (jamais exécuté contre un vrai Postgres avant : les tests Lot 3 ne mockaient que le QueryBuilder) : (1) `ORDER BY COALESCE(best_score...)` — TypeORM ne résout pas un alias dans une expression de fonction brute → fix via `addSelect(..., 'sortScore')` + `orderBy('"sortScore"')` ; (2) `.take()` génère un SQL invalide (`DISTINCT ... , , ...`) en combinaison avec `getRawAndEntities()` sur ce join — remplacé par `.limit()` (safe ici, jointure 1:1 par `GROUP BY`). E2e dédié prouvant le garde-fou demandé : trial réel reculé dans le passé (pas de `trial_duration_days` négatif) → `/search/candidates` → 403. 20 tests unitaires + 7 tests e2e ajoutés (258 tests unit / 27 suites, 12 tests e2e / 3 suites). `EF-RECR-01` validé ✅, Lot 4 en cours. | EF-RECR-02 (attente feu vert) |
| 2026-07-28 | Session 8 | Utilisateur : "accélère, enchaîne tous les tickets du Lot 4" → arrêt du mode story-par-story, Given/When/Then toujours dérivés du CDC §4.5 mais annoncés en résumé plutôt qu'en blocage. `EF-RECR-02` : `POST/GET/DELETE /companies/recruiters` — company_admin ajoute (utilisateur existant, email vérifié, non rattaché → rôle `RECRUITER` accordé) / retire (rôles `RECRUITER`+`COMPANY_ADMIN` retirés) des recruteurs ; auto-retrait bloqué (409, évite une entreprise sans admin, pas de flux de promotion dans ce MVP) ; isolation cross-entreprise en 404. Extraction de `SubscriptionGuardService` (partagé par la recherche du Lot 3 et, dans la foulée, les offres/shortlist) — `search.controller.ts` refactoré pour l'utiliser, comportement inchangé et re-testé. `EF-RECR-03` : `POST/GET /companies/offers`, `PATCH .../close`, `PATCH .../moderate` (admin/moderator uniquement) — une offre créée passe toujours par `pending_moderation`, jamais auto-publiée même par un company_admin ; clôture réservée aux offres `published` ; isolation cross-entreprise en 404. `EF-RECR-06` : `POST/GET/DELETE /companies/shortlist` — ajout limité aux profils indexés et non masqués (mêmes règles que EF-SRCH-03), partagé intra-entreprise (toute l'équipe recruteur voit/retire les entrées d'un collègue), doublon rejeté (409). En écrivant les e2e offres/shortlist, 2 fichiers de suite tournant en parallèle ont fait courir deux `AppModule` en concurrence sur la synchronisation de schéma TypeORM contre la même base réelle → 500 intermittent sur la création d'entreprise ; corrigé via `maxWorkers: 1` dans `test/jest-e2e.json`. 74 tests unitaires + 19 tests e2e ajoutés (304 tests unit / 34 suites, 27 tests e2e / 6 suites, tous verts, suite e2e relancée deux fois pour confirmer la stabilité). Lot 4 terminé ✅ (EF-RECR-01/02/03/06). | Lot 5 |
| 2026-07-29 | Session 9 | Recette isolation cross-entreprise demandée avant Lot 5 (risque n°1 du lot). Audit code réel : le filtrage des listes (`find({where:{companyId}})`) était déjà correct au niveau SQL. Les 3 mutations par ID (`removeRecruiter`, `closeOffer`, `removeEntry`) utilisaient la forme fragile `findOne({where:{id}})` + check applicatif `if (x.companyId !== companyId)` — corrigées vers `findOne({where:{id, companyId}})`, filtrage dans la clause SQL elle-même. `getCallerCompanyId`, dupliqué à l'identique dans les 3 services, factorisé en `SubscriptionGuardService.resolveCompanyId()` (résolution de société seule, sans check d'abonnement). Assertion explicite sur la forme du `WHERE` ajoutée dans les 3 specs unitaires. 310 tests unit / 34 suites + 27 e2e / 6 suites, tous verts (comportement HTTP inchangé, aucune régression). | Lot 5 |
| 2026-07-29 | Session 10 | ADR-0001 (`docs/adr/0001-tenant-isolation-strategy.md`) : isolation applicative documentée (résolution serveur du companyId, WHERE SQL sur lectures et mutations, RLS Postgres écartée pour l'instant — coût `current_setting`/compatibilité PgBouncer transaction-mode non justifié tant que tout passe par la couche repository). Lot 5A démarré : avant d'écrire, lecture du code réel a révélé qu'une entité `Subscription` existe déjà (Lot 0, câblée par le gate du Lot 3 et l'auto-provisioning trial du Lot 4/ADR-0001) — écart signalé à l'utilisateur plutôt que de dupliquer l'entité ou renommer silencieusement des champs déjà utilisés ; décision : réutiliser telle quelle (`contactsUsed`, `startsAt`/`endsAt`, enum 5 valeurs, `companyId` non unique). `ContactQuotaService.consumeOneContact(companyId)` : décrément atomique via un seul `UPDATE ... SET contacts_used = contacts_used + 1 WHERE company_id = :id AND status IN (trial, active) AND (ends_at IS NULL OR ends_at > :now) AND contacts_used < contact_quota`, jamais de lecture-puis-écriture ; `result.affected === 0` déclenche une lecture de diagnostic (sûre, après coup) pour distinguer `ContactQuotaExceededException` de `SubscriptionInactiveException`. Condition `ends_at` ajoutée au-delà de la spec littérale, alignée sur `SubscriptionGuardService.assertActiveSubscription`. Exposé via `ContactQuotaPort` (`src/ports/`), lié dans `CompaniesModule` (pas le `PortsModule` global, réservé aux adaptateurs stub externes). Aucune migration : aucun nouveau champ. Preuve d'atomicité par e2e réel contre Postgres (`Promise.allSettled` de 2 appels parallèles sur un quota restant de 1 → exactement 1 succès + 1 exception, `contacts_used` final correct). 316 tests unit / 35 suites + 30 e2e / 7 suites, tous verts. Lot 5A terminé ✅. | Lot 5B (Conversation/Message) |
| 2026-07-29 | Session 11 | Recette Lot 5A demandée avant Lot 5B : le `WHERE` de `consumeOneContact` filtrait sur `company_id`, colonne **non unique** sur `subscriptions` — si une entreprise se retrouvait un jour avec >1 ligne active, l'UPDATE aurait touché plusieurs lignes à la fois (double-décrément silencieux, `affected` devenant un compteur de lignes ambigu plutôt qu'un booléen de succès). Distinction actée avec l'utilisateur : c'est un problème d'**invariant de données** (le WHERE peut matcher plusieurs lignes distinctes), orthogonal au problème d'**atomicité/concurrence** (le verrou ligne-niveau protège correctement contre deux requêtes concurrentes visant une même ligne — raisonnement déjà correct, conservé). Fix : `resolveActiveSubscriptionId(companyId)` résout désormais la subscription active en amont (même critère d'activité que l'ancien WHERE) — 0 résultat → `SubscriptionInactiveException` (inchangée), >1 résultat → nouvelle `MultipleActiveSubscriptionsException` (échec bruyant, `InternalServerErrorException`, jamais de sélection silencieuse d'une ligne) — puis l'UPDATE atomique cible `WHERE id = :subscriptionId AND contacts_used < contact_quota` uniquement. La lecture de diagnostic après-coup a disparu (devenue inutile : `resolveActiveSubscriptionId` garantit déjà l'unicité et l'activité avant l'UPDATE). Le test e2e de concurrence existant (`test/contact-quota.e2e-spec.ts`) a été rejoué **sans aucune modification** pour prouver que le fix ne casse pas la garantie d'atomicité — toujours vert (3/3). 5 tests unitaires (2 nouveaux scénarios : 2 subscriptions actives → exception + aucune écriture sur aucune des deux lignes ; 0 active → `SubscriptionInactiveException` ; régression 1 active + quota disponible). Invariant « au plus une subscription active par entreprise » documenté comme dette : appliqué en code uniquement, pas encore en base — voir Décisions techniques Lot 5. | Lot 5B (Conversation/Message) |
| 2026-07-30 | Session 12 | Lot 5B : `Conversation`/`Message` + ouverture de fil transactionnelle. Avant d'écrire : code réel de `ContactQuotaService` montré (signatures Lot 5A), et recherche confirmée qu'**aucune convention de transaction TypeORM n'existe dans ce repo** (`dataSource.transaction`, `queryRunner`, `@Transactional` : zéro occurrence) — idiome standard NestJS/TypeORM (`DataSource.transaction()`) adopté faute de précédent à suivre. `candidateId` pointe vers `CandidateProfile.id` (même cible que `ShortlistEntry.candidateProfileId`, seul précédent du module) ; `recruiterId` stocke le `User.id` de l'appelant (même convention que `JobOffer.createdBy`/`ShortlistEntry.addedBy`). Entités + **première vraie migration du repo** (`CreateMessagingTables`) : a révélé que `migration:generate`/`run` n'avaient **jamais fonctionné** dans ce repo — même famille de bug que le gap `moduleNameMapper` de la recette Lot 2 (les imports `.js` de ce repo, résolus par tsc en mode NodeNext, ne sont pas résolus par le hook `require()` CJS de ts-node) — corrigé par un petit shim de résolution (`scripts/resolve-js-as-ts.js`) chargé via `npm run typeorm`. Migration générée par diff réel contre la DB dev (serveur `start:dev` arrêté d'abord pour empêcher `DB_SYNCHRONIZE=true` de produire un diff vide), puis appliquée via `migration:run`. `ContactQuotaService.consumeOneContact(companyId, manager?)` : paramètre optionnel rétrocompatible (Lot 5A inchangé, 5/5 tests toujours verts), utilise `manager.getRepository(Subscription)` quand fourni. `ConversationService.openConversation` : une seule `dataSource.transaction()` englobant le décrément et les inserts `Conversation`+`Message` ; idempotence sur `UNIQUE (candidate_id, company_id)` — violation interceptée après rollback, fil existant relu et retourné sans reconsommer de quota, jamais de `findOne` préalable. `sendMessage` résout le rôle de l'appelant puis scope chaque lookup à `WHERE id + (companyId | candidateId)` directement (ADR-0001), ne consomme aucun quota. Preuve d'atomicité par échec réel : `Repository.prototype.save` patché (scopé aux entités `Message`, restauré aussitôt après) pour rejeter au sein de la vraie transaction contre Postgres réel — `contacts_used` relu inchangé, aucune ligne `Conversation` créée. Preuve de concurrence : 2 `openConversation` parallèles sur la même paire → exactement 1 fil, exactement 1 décrément net. 12 tests unitaires + 7 tests e2e ajoutés (325 tests unit / 36 suites + 37 e2e / 8 suites, tous verts). Lot 5 terminé ✅ (5A + 5B). | Lot 6 |
| 2026-07-30 | Session 13 | Recette Lot 5B (outillage migration) demandée avant Lot 6 : portabilité du shim `resolve-js-as-ts.js` confirmée (même mécanisme que `tsconfig-paths/register`, déjà dans ce repo, patch du même hook CJS stable, aucun chemin absolu ni état machine-spécifique) ; `down()` de `CreateMessagingTables` prouvée par round-trip réel (`up`→`down`→`up`) contre Postgres, vérifié par requêtes `psql` fraîches, pas par le message du CLI. Découverte structurante au passage : `CreateMessagingTables` échoue en `42P01` sur une base migrations-only (rôle/DB reproduisant exactement le service Postgres CI) — aucune migration ne capture les ~19 tables préexistantes, nées via `synchronize: true` depuis le Lot 0 ; la CI tourne en `DB_SYNCHRONIZE: true` et n'invoque jamais `migration:*`. Dette de release, pas de lot → **ADR-0002** (`docs/adr/0002-schema-migration-governance.md`) créé, incluant le critère mécanique de validité d'une baseline (`schema:log` vide après migrations, sur base vierge). Chantier baseline lancé : `BaselineSchema1700000000000` générée depuis les 19 entités préexistantes contre une base vierge (`conversation.entity.ts`/`message.entity.ts` extraits temporairement du glob le temps de la génération, pour ne pas dupliquer `CreateMessagingTables`), ordonnée avant elle. Preuve du critère ADR-0002 : `typeorm schema:log` → *"Your schema is up to date"* après application des deux migrations sur base vierge ; double-preuve `pg_dump --schema-only` contre une base construite uniquement par `synchronize: true` (21 entités) → aucune différence de schéma applicatif (seuls écarts : jeton `\restrict` aléatoire de `pg_dump`, et `migrations_id_seq` propre à la table de suivi). `CreateMessagingTables` redevient autonome (plus de `42P01`) une fois précédée de la baseline. `down()` de la baseline également prouvée par round-trip réel. Trigger 2 de l'ADR-0002 (Lot 6, index unique partiel sur `Subscription`) débloqué. | Chantier baseline — synchronize:false hors dev + job CI migration-only |

---

## Détail du Lot 5 — Messagerie & quotas (✅ Terminé)

Sous-lots :

- [x] **5A** — `ContactQuotaService.consumeOneContact()` derrière `ContactQuotaPort`, décrément atomique du quota de contacts sur `Subscription` (entité réutilisée du Lot 0/4, aucune migration)
- [x] **5B** — entités `Conversation`/`Message` (première vraie migration du repo), `ConversationService.openConversation` transactionnel (décrément + création du fil dans une seule transaction, idempotence par contrainte unique DB), `sendMessage` sans consommation de quota

---

## Décisions techniques Lot 5

- **`Subscription` réutilisée, pas recréée** : le Lot 5A devait initialement introduire "l'entité minimale nécessaire à la messagerie", mais l'entité existe déjà depuis le Lot 0 et est câblée par le gate d'abonnement du Lot 3 et l'auto-provisioning trial du Lot 4 (ADR-0001). Décision utilisateur : conserver les noms de champs existants (`contactsUsed`, `startsAt`/`endsAt`, enum status à 5 valeurs `TRIAL/ACTIVE/PAST_DUE/CANCELLED/EXPIRED`, `companyId` non unique avec sélection de la ligne la plus récente) plutôt que de renommer vers une spec différente qui aurait cassé le Lot 3/4 silencieusement.
- **Décrément atomique, ciblé sur `id` (fix Session 11)** : `company_id` sur `subscriptions` n'est **pas unique** — un `UPDATE ... WHERE company_id = :id` peut donc matcher plusieurs lignes pour une même entreprise (problème d'invariant de données, orthogonal à l'atomicité du verrou ligne-niveau). `consumeOneContact` résout d'abord `resolveActiveSubscriptionId(companyId)` (même critère d'activité qu'avant : `status IN (trial, active) AND (ends_at IS NULL OR ends_at > now)`) — 0 résultat → `SubscriptionInactiveException`, >1 résultat → `MultipleActiveSubscriptionsException` (échec bruyant, jamais de sélection silencieuse), exactement 1 → son `id`. L'UPDATE atomique cible ensuite `WHERE id = :subscriptionId AND contacts_used < contact_quota` uniquement — jamais de lecture-puis-écriture pour le décrément lui-même, `result.affected` détermine le succès sans ambiguïté possible puisque `id` est la clé primaire.
- **Dette : invariant « au plus une subscription active par entreprise » appliqué en code, pas en base.** `MultipleActiveSubscriptionsException` fait échouer l'appel si l'invariant est violé, mais rien n'empêche aujourd'hui l'insertion de deux lignes actives pour la même entreprise au niveau Postgres. À corriger au Lot 6 (propriétaire futur de `Subscription`/des migrations) via un index unique partiel : `CREATE UNIQUE INDEX ... ON subscriptions (company_id) WHERE status IN ('trial', 'active')` — même logique de défense en profondeur que l'ADR-0001 (garantie applicative testée maintenant, contrainte DB en complément plus tard, jamais silencieusement omise).
- **Condition `ends_at` ajoutée au-delà de la demande initiale** : aligne `consumeOneContact` sur la définition d'« actif » déjà utilisée par `SubscriptionGuardService.assertActiveSubscription` — sans elle, un trial dont le statut n'a pas encore été basculé par un job (inexistant avant le Lot 6) aurait pu continuer à consommer du quota après sa propre expiration.
- **`ContactQuotaPort` lié dans `CompaniesModule`, pas `PortsModule`** : `PortsModule` est réservé aux adaptateurs stub de fournisseurs externes (scoring, PSP, mail, antivirus, stockage). `ContactQuotaPort` est une frontière interne entre bounded contexts (Messagerie ↔ Companies/Facturation), pas une dépendance tierce — le lier dans `CompaniesModule` (qui possède `Subscription`) et l'exporter pour que le futur module Messagerie (5B) l'importe est plus cohérent avec l'usage réel de `PortsModule` dans ce repo.
- **Transaction unique décrément + création du fil (5B)** : aucune convention de transaction TypeORM n'existait dans ce repo avant le Lot 5B (`dataSource.transaction`, `queryRunner`, `@Transactional` : zéro occurrence) — `DataSource.transaction()` (idiome standard NestJS/TypeORM, aucune dépendance supplémentaire) adopté faute de précédent. `ContactQuotaService.consumeOneContact(companyId, manager?)` accepte un `EntityManager` transactionnel optionnel (rétrocompatible : les appelants Lot 5A ne le passent pas et le comportement est inchangé) ; `ConversationService.openConversation` ouvre une seule transaction pour le décrément + les inserts `Conversation`/`Message` — tout échec fait tout rollbacker, le quota n'est jamais consommé sans fil créé.
- **Idempotence par contrainte DB, pas par `findOne` préalable (5B)** : `Conversation` porte `UNIQUE (candidate_id, company_id)`. `openConversation` ne vérifie pas l'existence du fil avant d'insérer ; si la contrainte rejette l'insert (violation `23505`), la transaction — décrément inclus — a déjà rollbacké, et le service relit puis retourne le fil existant sans reconsommer de quota. Sous concurrence, deux appels parallèles sur la même paire ne peuvent jamais produire deux fils ni deux décréments nets, quel que soit celui des deux INSERT qui gagne la course sur l'index unique (prouvé par un test e2e réel, `test/conversation.e2e-spec.ts`).
- **Première vraie migration du repo, et un bug d'infra pré-existant découvert au passage** : `migration:generate`/`run`/`revert` n'avaient jamais fonctionné dans ce repo (aucune migration n'existait avant `CreateMessagingTables`). Cause : les imports `.js` de ce repo (résolus par `tsc` en mode NodeNext vers les fichiers `.ts` correspondants) ne sont pas résolus par le hook `require()` CJS de `ts-node`, qui cherche littéralement un fichier `.js` inexistant sur disque en dev — même famille de bug que le `moduleNameMapper` manquant de Jest e2e trouvé en recette Lot 2. Corrigé par `scripts/resolve-js-as-ts.js` (require-hook qui retente en `.ts` quand un `.js` littéral n'existe pas), chargé via le flag `-r` du script `npm run typeorm`.

---

## Chantier infrastructure — schéma gouverné par migrations (ADR-0002, 🟨 en cours)

Dette de release découverte en recette du Lot 5B (session 13) : le schéma (~19 tables hors messagerie) n'a jamais été capturé par une migration, uniquement construit via `synchronize: true`. Trois livrables, en commits séparés et chacun vérifiable seul :

- [x] **Migration baseline** — `BaselineSchema1700000000000`, générée depuis les 19 entités préexistantes contre une base vierge, ordonnée avant `CreateMessagingTables`. Validée par le critère mécanique de l'ADR-0002 (`schema:log` vide après migrations sur base vierge) + double-preuve `pg_dump --schema-only` contre une base `synchronize: true`. `down()` prouvée par round-trip réel.
- [ ] **`synchronize: false` hors dev** — déjà la valeur par défaut du code applicatif (`Joi.boolean().default(false)`, `.env.example`) ; reste à l'imposer côté CI et à vérifier que la suite e2e passe intégralement en local avec les migrations à la place de `synchronize`.
- [ ] **Job CI migration-only** — base Postgres vierge, `synchronize: false`, toutes les migrations appliquées dans l'ordre, puis suite e2e complète dessus. Seul moyen d'empêcher que la dette se reforme silencieusement.

---

## Détail du Lot 4 — Espace recruteur & offres (✅ Terminé)

Stories dans l'ordre :

- [x] `EF-RECR-01` — création d'un compte entreprise (KYB léger : ICE 15 chiffres + RC libre, auto-provisionnement `Recruiter` + rôle `company_admin` + `Subscription` trial expirable)
- [x] `EF-RECR-02` — gestion de plusieurs utilisateurs sous un compte (company_admin ajoute/retire des recruiters ; isolation stricte par entreprise)
- [x] `EF-RECR-03` — publication et gestion d'offres (modération avant publication par admin/moderator, cycle de vie pending_moderation → published/rejected → closed)
- [x] `EF-RECR-06` — shortlist / viviers (Should — sauvegarde de profils, partage intra-entreprise)

---

## Décisions techniques Lot 4

- **Origine des critères d'acceptation** : le backlog livré ne détaille pas l'Épic recruteur (seul `US-RECR-05` y figure). Les Given/When/Then de EF-RECR-01/02/03/06 sont dérivés du CDC §4.5 par la session et validés avec l'utilisateur avant chaque implémentation — à traiter comme faisant foi au même titre qu'un backlog fourni, mais à distinguer si un vrai backlog détaillé arrive plus tard.
- **`company_admin` n'est jamais auto-attribuable à l'inscription** (`POST /auth/register` n'autorise que `candidate`/`recruiter`, inchangé). On le devient uniquement en créant une entreprise via `POST /companies` — évite qu'un rôle à fort privilège soit déclaratif côté client.
- **Un seul rattachement entreprise par utilisateur** : `Recruiter.userId` est unique (contrainte déjà présente depuis le Lot 0) → un `POST /companies` alors qu'un `Recruiter` existe déjà rejette en 409, pas de double-appartenance au MVP.
- **ICE unique** : contrainte `unique: true` ajoutée sur `Company.ice` (defense in depth ; le service vérifie aussi explicitement avant insert pour renvoyer un 409 propre plutôt qu'une erreur de contrainte brute).
- **Trial jamais illimité** : `Subscription.endsAt` est **toujours** renseigné à la création (`createdAt + trial_duration_days`, settings `trial_duration_days` / env `TRIAL_DURATION_DAYS`, fallback 14j). Le gate d'abonnement du Lot 3 (`search.controller.ts`) vérifiait déjà correctement `endsAt` s'il est présent — le risque n'était donc pas dans le gate mais dans un provisionnement qui aurait pu laisser `endsAt` null. Prouvé par e2e : trial réel reculé dans le passé après création (pas de `trial_duration_days` négatif, qui aurait testé une config tordue plutôt que le gate lui-même) → `/search/candidates` → 403.
- **Quota trial** : palier `starter` par défaut, `contactQuota` lu via `SettingsService.getNumber('plan_starter_contacts', 'PLAN_STARTER_CONTACTS')` (jamais en dur), cohérent avec la grille pricing §5.4 du CDC.
- **Bugs Lot 3 découverts en écrivant l'e2e de bouclage** (`SearchService`, jamais exécuté avant contre un vrai Postgres — les tests Lot 3 ne mockaient que le QueryBuilder) :
  1. `ORDER BY COALESCE(best_score.best_value, 0)` — TypeORM essaie de résoudre un alias dans une expression de fonction brute et échoue (`"COALESCE(best_score" alias was not found`). Fix : sélectionner l'expression sous un alias dédié (`addSelect(..., 'sortScore')`) et trier sur cet alias plutôt que l'expression brute.
  2. `.take()` combiné à `getRawAndEntities()` sur ce join génère un SQL invalide (virgule vide dans le `SELECT DISTINCT` de la sous-requête de pagination que TypeORM construit automatiquement pour rester correct sous des jointures one-to-many). Remplacé par `.limit()` — sûr ici car la jointure `best_score` est fonctionnellement 1:1 (`GROUP BY candidate_id` dans la sous-requête).
- **EF-RECR-03 — modération obligatoire, jamais auto-approuvée** : une offre créée passe toujours par `pending_moderation`, quel que soit le rôle de son créateur (même `company_admin`). Seule `PATCH /companies/offers/:id/moderate`, réservée à `Role.ADMIN`/`Role.MODERATOR`, peut la faire passer à `published`/`rejected`. Aucun flux d'auto-approbation, cohérent avec CDC §4.5 "Modération avant publication".
- **EF-RECR-03 — quota d'offres actives par palier non implémenté** : le CDC §5.4 lie "Offres publiées actives" au palier d'abonnement (Starter:1, Growth:5, Scale:20), mais ce n'est pas une exigence numérotée séparée du backlog/CDC pour ce lot — descopé pour rester dans le périmètre de la story, à traiter au Lot 6 (Abonnement & facturation) avec le reste de la logique de paliers.
- **EF-RECR-03/06 — specialtyId non validé contre le référentiel** : stocké comme UUID optionnel simple (format validé, existence non vérifiée contre `Specialty` du module assessments) pour éviter un couplage cross-module non indispensable au MVP de cette story.
- **EF-RECR-06 — visibilité alignée sur la recherche (EF-SRCH-03)** : impossible d'ajouter à la shortlist un profil non indexé ou masqué — mêmes règles que `/search/candidates`, pour qu'un recruteur ne puisse jamais shortlister un profil qu'il n'aurait pas pu trouver via la recherche elle-même.
- **`SubscriptionGuardService` extrait** (`src/modules/companies/subscription-guard.service.ts`) : la vérification "abonnement actif" du Lot 3 (`search.controller.ts`) est réutilisée telle quelle par la création d'offre et l'ajout en shortlist — 3e usage identique, donc factorisé plutôt que recopié une nouvième fois. `search.controller.ts` refactoré pour la consommer ; comportement inchangé, testé indépendamment.
- **`test/jest-e2e.json` — `maxWorkers: 1`** : les suites e2e partagent une seule base Postgres réelle ; en parallèle, plusieurs `AppModule` (un par fichier de suite) synchronisaient le schéma TypeORM en même temps, provoquant un 500 intermittent sur la création d'entreprise. Sérialisé les fichiers e2e pour éliminer la race.
- **Isolation cross-entreprise — mutations par ID durcies** : recette demandée par l'utilisateur sur `removeRecruiter`/`closeOffer`/`removeEntry`. Les trois chargeaient la ressource via `findOne({ where: { id } })` puis comparaient `resource.companyId !== companyId` en JS — forme fragile (un bug futur oubliant le check laisserait une fuite cross-entreprise). Corrigé vers `findOne({ where: { id, companyId } })` : le filtrage se fait dans la clause SQL elle-même, une ressource d'une autre entreprise n'est structurellement jamais chargée. `getCallerCompanyId`, dupliqué à l'identique dans les 3 services, factorisé en `SubscriptionGuardService.resolveCompanyId()` (résolution de société seule, sans vérifier l'abonnement — utilisée par les mutations qui doivent rester accessibles même abonnement expiré). Chaque spec unitaire a maintenant une assertion explicite sur la forme du `WHERE` (`expect(repo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id, companyId } }))`).

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

## Recette Lot 2 — webhook durci (2026-07-28)

Une recette du webhook `POST /assessments/webhook` a mis en évidence deux failles réelles avant le passage au Lot 4 :

1. **Raw body non capturé** : le controller déclarait `@Req() rawBody: Buffer` mais NestJS ne capture pas les octets bruts par défaut (le body-parser JSON parse et remplace le body) — le paramètre était en réalité l'objet `Request` d'Express, pas un `Buffer`. Toute vérification de signature future aurait haché les mauvais octets.
2. **Aucune authentification réelle** : `StubScoringAdapter.verifyWebhookSignature()` retournait `{ valid: true }` inconditionnellement, sans lire ni le payload ni la signature. N'importe qui pouvait POST un score sans preuve d'origine.

Corrections apportées :

- **Raw body réel** : `NestFactory.create(AppModule, { rawBody: true })` dans `main.ts` ; le controller type désormais `@Req() req: RawBodyRequest<Request>` et lit `req.rawBody` (rejet `400` si absent — ex. mauvais `Content-Type`).
- **HMAC-SHA256 réel** : `StubScoringAdapter.verifyWebhookSignature()` calcule `HMAC-SHA256(secret, rawBody)` et compare en *timing-safe* (`crypto.timingSafeEqual`, avec garde de longueur pour éviter l'exception native sur signatures de longueur différente) à la signature du header `x-scoring-signature`. `externalId` extrait du payload **après** vérification de la signature, jamais avant.
- **Secret** : nouvelle clé `SCORING_WEBHOOK_SECRET` (`src/config/scoring.config.ts`), lue via `ConfigService`, jamais loggée. **Absence de secret ⇒ échec fermé** (toute signature est rejetée), pas de bypass. Ajoutée à `.env.example`, `docker-compose.yml` et au job CI.
- **Tests de rejet réels** (pas de mock sur la fonction testée) : `src/adapters/scoring/__tests__/stub-scoring.adapter.spec.ts` — pas de header signature, mauvaise signature, payload altéré (tampering), secret absent (fail-closed), signature de longueur différente (pas d'exception), bonne signature (accepté + externalId extrait).
- **Test e2e réel** : `test/webhook.e2e-spec.ts` — 4 scénarios contre l'app + Postgres réels (pas de mock) : (a) sans signature → 403, (b) mauvaise signature → 403, (c) bonne signature → 200 + Score persisté, (d) replay de la même requête → idempotent. A révélé au passage que **`test/jest-e2e.json` n'avait jamais eu le `moduleNameMapper` nécessaire aux imports `.js`** — `npm run test:e2e` n'avait donc probablement jamais tourné avec succès contre le vrai `AppModule` depuis la création du repo ; corrigé, et l'étape `E2E test` est maintenant câblée dans la CI. Le fichier `test/app.e2e-spec.ts` (boilerplate Nest testant une route `/` inexistante) a été remplacé par un smoke test réel sur `/health`.

---

## Décisions techniques Lot 2

- **Fournisseur scoring** : non choisi. Code contre le port `ScoringProvider` avec stub mock. Le vrai fournisseur (Codility/HackerRank) sera branché via un nouvel adaptateur sans toucher au domaine.
- **Anti-triche MVP** : socle (timer strict, session unique, 1 tentative/90j/test, cooldown affiché) + détection plagiat exposée comme capacité du port. **Signaux comportementaux (frappe/temps) reportés en V1.**
- **Cooldown** : configurable via `assessment_cooldown_days` (settings table, fallback = 90).
- **Incident management** : `resumeToken` (UUID) régénéré à chaque reprise. Reprise ne consomme pas de tentative, ne crée pas de nouvelle session ScoringProvider.
- **Score entity enrichi** : `testVersion` (audit reproductibilité) + `plagiarismVerdict` (enum clean/suspected/confirmed).
- **Webhook scoring** : idempotent (vérifie existence Score avant traitement), signature vérifiée via `ScoringProvider.verifyWebhookSignature()` (HMAC-SHA256 réel depuis la recette du 2026-07-28, voir section dédiée ci-dessus). Score normalisé à 0-100 (score/maxScore*100). Pas de JWT, authentification par signature header `x-scoring-signature`.
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
