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
| **Lot 1** | Module candidat (profil, CV, liens, complétude 70 %) | Lot 0 | 🟨 En cours | 2026-07-28 | US-CAND-01 à US-CAND-08 |
| **Lot 2** | Évaluation & scoring (adaptateur API réel + webhook + anti-triche + barème) | Lot 0, 1 | ⬜ À faire | — | ⚠️ Choisir le fournisseur scoring ici. Anti-triche = cœur de crédibilité |
| **Lot 3** | CVthèque & recherche (indexation selon seuils) | Lot 1, 2 | ⬜ À faire | — | FTS Postgres au MVP |
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

## Détail du Lot 1 — Module candidat (🟨 En cours)

Stories dans l'ordre :

- [x] `US-CAND-01` — inscription + vérification email (couvert par Lot 0 + tests DTO ajoutés)
- [x] `US-CAND-02` — profil + calcul de complétude (seuil 70 %, barème pondéré CDC §5.1)
- [ ] `US-CAND-03` — upload CV (FileScanner + ObjectStorage, PDF/DOCX <= 5 Mo)
- [ ] `US-CAND-08` — export / suppression des données (droits CNDP/RGPD)

---

## Prochaines stories (après Lot 1) — ordre recommandé

Vertical slice candidat (chemin critique de valeur) :

1. `US-EVAL-02` / `US-EVAL-03` — passage de test + score (ScoringProvider réel)
2. `US-EVAL-SEUIL` — indexation CVthèque selon seuils

Pour chaque story : ses critères Given/When/Then du backlog = la Definition of Done. Rester dans le périmètre de la story, ne pas déborder.

---

## Journal (à compléter par chaque session)

| Date | Session | Ce qui a été fait | Prochaine étape |
|---|---|---|---|
| — | — | Initialisation du repo et des specs | Démarrer Lot 0 |
| 2026-07-28 | Session 1 | Lot 0 complet : NestJS strict, TypeORM Data Mapper, auth JWT+refresh rotation, RBAC 5 rôles cumulatifs, 5 ports+stubs, audit, settings configurable, health check, Docker, CI. 7 commits, 66 tests (10 suites), 89% coverage. | Lot 1 : US-CAND-01 |
| 2026-07-28 | Session 2 | US-CAND-01 confirmée (couverte par Lot 0 + tests DTO). US-CAND-02 : profil candidat (service + controller + DTOs), calcul complétude pondéré (7 critères CDC §5.1, poids en settings), entités Experience + ProfileLink, firstName/lastName sur profil. 22 tests ajoutés (95 total). | US-CAND-03 |

---

## Garde-fous permanents

- **Ne pas démarrer un lot dont les dépendances ne sont pas ✅.**
- **DPIA / démarche CNDP** : administrative, à mener en parallèle dès le Lot 0 (hors code, mais conditionne la mise en prod).
- Ne jamais inventer une valeur métier non tranchée : la marquer TODO/config et le signaler dans le journal.
