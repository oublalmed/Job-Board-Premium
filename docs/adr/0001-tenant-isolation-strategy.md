# 0001 — Stratégie d'isolation multi-tenant (recruteurs / offres / shortlists)

## Statut

**Accepted** — 2026-07-29

Aucune convention ADR n'existait encore dans ce repo ; ce fichier ouvre la série sous `docs/adr/`, numérotation séquentielle (`NNNN-titre-court.md`).

## Contexte

Job Board Premium est une plateforme multi-tenant côté recruteur : chaque `Company` porte ses propres `Recruiter` (utilisateurs rattachés), `JobOffer` (offres) et `ShortlistEntry` (viviers). Un concurrent qui parviendrait à lire ou modifier les données d'une autre entreprise (lister ses recruteurs, fermer ses offres, vider son vivier) est le risque n°1 identifié sur le Lot 4 (Espace recruteur & offres) — c'est une fuite de données commercialement sensibles entre clients payants, pas un bug fonctionnel mineur.

Le Lot 4 introduit trois surfaces qui doivent respecter cette isolation :
- `RecruiterService` (`src/modules/companies/recruiter.service.ts`)
- `JobOfferService` (`src/modules/companies/job-offer.service.ts`)
- `ShortlistService` (`src/modules/companies/shortlist.service.ts`)

Une recette dédiée (session du 2026-07-29) a par ailleurs révélé qu'une première version de l'isolation sur les mutations par ID était implémentée sous une forme fragile (voir Alternative écartée B ci-dessous), corrigée avant cet ADR — ce document formalise la stratégie qui en résulte pour qu'elle ne soit pas réintroduite par erreur.

## Décision

**Isolation applicative, appliquée côté serveur à chaque requête, jamais déléguée au client ni à la base seule.**

1. **Résolution du `companyId` — un seul point de vérité.** `SubscriptionGuardService.resolveCompanyId(userId)` résout le `companyId` de l'appelant depuis son `Recruiter` (`Recruiter.userId = user.sub` du JWT signé serveur). Aucun des trois services n'accepte `companyId` en paramètre de méthode publique, aucun DTO d'entrée (`CreateJobOfferDto`, `AddRecruiterDto`, `AddShortlistEntryDto`, etc.) n'a de champ `companyId` — il ne peut donc jamais être injecté par le client.

2. **Le `companyId` est injecté dans la clause `WHERE` SQL elle-même, pour les lectures ET les mutations :**
   - Listes (lecture) : `repo.find({ where: { companyId } })` — filtrage par la requête Postgres, jamais un `.filter()` applicatif après un `findAll()` sans condition.
   - Mutations par ID (`removeRecruiter`, `closeOffer`, `removeEntry`) : `repo.findOne({ where: { id, companyId } })` — la ressource d'une autre entreprise n'est structurellement jamais chargée en mémoire, il n'y a pas de comparaison `if (x.companyId !== companyId)` après coup dont l'oubli futur romprait l'isolation.

3. **Preuve par les tests, pas seulement par la revue de code :**
   - Unitaire : chaque service a une assertion explicite sur la forme du `WHERE`, ex. `expect(repo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id, companyId } }))` (`recruiter.service.spec.ts`, `job-offer.service.spec.ts`, `shortlist.service.spec.ts`).
   - E2E : un scénario dédié par surface prouve le `404` cross-entreprise avec de vraies données créées via l'API (pas de seed SQL manuel) — `recruiter.e2e-spec.ts` ("does not let a company_admin remove another company's recruiter"), `job-offer.e2e-spec.ts` ("does not let a recruiter close another company's offer"), `shortlist.e2e-spec.ts` ("does not let a recruiter remove another company's shortlist entry").

## Alternatives écartées

**A. Row-Level Security (RLS) PostgreSQL.**
Activer RLS sur `recruiters`, `job_offers`, `shortlist_entries` avec une policy `USING (company_id = current_setting('app.current_company_id'))`, la connexion applicative fixant `current_company_id` par requête. Écartée **pour l'instant**, pas définitivement :
- Nécessite de faire transiter le contexte tenant jusqu'à la session Postgres (`SET LOCAL` par requête, ou un rôle par tenant), ce qui n'existe pas dans la couche TypeORM actuelle du projet (pas de migrations non plus à ce stade — schéma généré via `synchronize`, cf. `PROGRESS.md`).
- Coût d'implémentation non justifié à ce stade : gestion de `current_setting('app.company_id')` par connexion, et sa compatibilité avec le pooling PgBouncer en mode transaction (le mode le plus courant en prod, où une connexion physique est partagée entre transactions de tenants différents — `SET LOCAL` doit alors être réappliqué à chaque transaction, jamais supposé persistant sur la connexion). Ce coût n'est pas justifié tant que toute écriture passe par la couche repository des trois services et que l'isolation y est prouvée par tests (unitaires + e2e).
- Ajoute une couche de configuration et de diagnostic (policies invisibles depuis le code applicatif, erreurs RLS moins lisibles qu'une exception NestJS) pour un gain immédiat marginal tant que tous les accès passent par les repositories TypeORM des trois services ci-dessus.
- Reste l'option de défense en profondeur naturelle si le risque résiduel (ci-dessous) se matérialise.

**B. Chargement par ID puis vérification applicative (`if (resource.companyId !== companyId)`).**
C'est la forme initialement implémentée pour les trois mutations, corrigée le 2026-07-29 avant cet ADR. Écartée car elle charge la ressource en mémoire avant de décider si l'appelant a le droit de la voir, et parce que l'isolation dépend alors de la présence d'un `if` que n'importe quelle modification future du service pourrait omettre — un risque de régression silencieuse plutôt qu'une garantie structurelle.

## Conséquences

- **Positif** : l'isolation est garantie au niveau de la requête SQL générée (le driver Postgres ne renvoie jamais une ligne hors du tenant courant), testée explicitement (forme du `WHERE` en unitaire, comportement HTTP en e2e), et ne dépend d'aucune configuration base de données supplémentaire à opérer ou déboguer.
- **Négatif / risque résiduel** : la garantie vit dans la couche service applicative. Un accès qui contournerait cette couche — requête SQL brute écrite à la main, script de migration ou de maintenance direct sur la base, futur endpoint qui réutiliserait le repository sans repasser par `resolveCompanyId`/`assertActiveSubscription` — ne serait **pas** intercepté par la base de données elle-même. RLS fermerait ce risque résiduel en le déplaçant dans Postgres, indépendamment du code applicatif.
- **Dette explicite** : toute nouvelle surface manipulant `Recruiter`, `JobOffer` ou `ShortlistEntry` (ou une future entité tenant-scopée) doit reproduire exactement ce pattern (`resolveCompanyId` + `companyId` dans le `WHERE`) — ce n'est pas automatique, donc à rappeler en revue de code tant que RLS n'est pas en place.

## Trigger de revisite

Réexaminer cette décision (probablement vers RLS) si l'un de ces événements survient :
1. **Passage en production multi-tenant à fort enjeu** (clients payants réels, pas seulement un MVP en développement).
2. **Audit de sécurité externe** (pentest, revue conformité CNDP/RGPD) qui recommande une défense en profondeur au niveau base de données.
3. **Première requête SQL brute ou script de migration/maintenance** touchant `recruiters`, `job_offers` ou `shortlist_entries` en dehors des trois services applicatifs ci-dessus — à ce moment-là, le risque résiduel documenté ci-dessus cesse d'être théorique.
