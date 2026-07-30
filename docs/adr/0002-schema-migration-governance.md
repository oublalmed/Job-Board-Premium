# 0002 — Gouvernance des migrations de schéma

## Statut

**Accepted** — 2026-07-30

`docs/adr/0001-tenant-isolation-strategy.md` est le seul ADR existant à ce jour ; celui-ci prend le numéro suivant dans la série.

## Contexte

Le schéma de base de données de Job Board Premium (~15 tables : `users`, `companies`, `recruiters`, `subscriptions`, `candidate_profiles`, `job_offers`, `shortlist_entries`, `assessments`, `scores`, `settings`, `audit_logs`, etc.) est né et a évolué, depuis le Lot 0, exclusivement via `synchronize: true` — TypeORM compare les entités au schéma réel à chaque démarrage et applique lui-même les changements nécessaires. Aucune migration ne capture cet état : le dossier `src/database/migrations/` était vide jusqu'au Lot 5B.

Le Lot 5B (`Conversation`/`Message`, messagerie) a produit `CreateMessagingTables`, la première vraie migration de ce repo — et la première dont les `up()`/`down()` portent des contraintes de clé étrangère vers ce schéma préexistant (`conversations.candidate_id → candidate_profiles.id`, `conversations.company_id → companies.id`). En testant sa portabilité, l'exécuter seule contre une base neuve (rôle/DB reproduisant exactement le service Postgres de la CI : `jobboard` / `test_password` / `jobboard_test`, schéma vierge) a échoué :

```
error: relation "companies" does not exist
code: 42P01 (undefined_table)
```

La transaction de la migration a bien rollback proprement (seule la table de suivi `migrations` restait après l'échec, vérifié par requête `psql` fraîche) — ce n'est donc pas un problème d'intégrité, mais la preuve concrète que `CreateMessagingTables` dépend d'un schéma qu'aucune migration ne construit. Elle ne peut aujourd'hui tourner que sur une base déjà peuplée par `synchronize: true`.

`.github/workflows/ci.yml` fixe `DB_SYNCHRONIZE: 'true'` (ligne 45) et n'invoque `migration:generate`, `migration:run` ni `migration:revert` à aucune étape du pipeline (lint, test, e2e, build). La CI ne s'est donc jamais aperçue que le chemin migration était, jusqu'au Lot 5B, entièrement non fonctionnel (bug d'outillage `ts-node`/imports `.js` corrigé au Lot 5B, `scripts/resolve-js-as-ts.js`), et elle ne peut pas s'apercevoir aujourd'hui que ce chemin reste incomplet.

## Risque

`synchronize: true` en environnement partagé (staging, production) est dangereux, pas seulement rustique :

- TypeORM peut **supprimer des colonnes ou des tables** qu'il juge orphelines pour faire correspondre le schéma réel aux entités — donc perdre des données — sans avertissement, sans revue, et sans étape de confirmation.
- Il n'existe **aucune trace versionnée** de ce qui a changé sur le schéma : pas de `down()`, pas d'historique, pas de possibilité de rollback ciblé. Une régression de schéma ne se diagnostique qu'a posteriori, en comparant l'état réel de la base à ce que les entités décrivent *aujourd'hui* — le schéma d'hier a disparu sans laisser de trace.
- C'est incompatible avec les exigences du CDC (§9 exploitation, §10 ENF-08 « sauvegardes testées », §11 audit) et l'esprit de traçabilité déjà posé par l'ADR-0001 (défense en profondeur, garanties vérifiables). Un audit CNDP/RGPD qui demanderait « comment le schéma portant des données personnelles (`candidate_profiles`, `documents`, `audit_logs`) évolue-t-il, et comment revenez-vous en arrière sur un changement problématique » n'a pas de réponse acceptable avec `synchronize: true`.

Ce risque est **non bloquant en développement local** (base jetable, un seul développeur, aucune donnée réelle) et **bloquant avant tout déploiement en environnement partagé** (staging ou production), où une base persistante et partagée transforme chaque redémarrage applicatif en modification de schéma non revue.

## Décision

La dette est **acceptée temporairement**, explicitement tracée plutôt que corrigée dans l'urgence en fin de Lot 5B :

- `synchronize: true` reste toléré **en développement local uniquement**.
- **Avant le premier déploiement en environnement partagé** (staging ou production), trois conditions doivent être remplies :
  1. **Migration baseline** capturant l'état actuel des ~15 tables existantes, générée depuis les entités réelles et **prouvée sur une base vierge** (appliquée de zéro, pas seulement générée) — `CreateMessagingTables` doit s'exécuter après elle dans l'ordre, et redevient alors autonome (elle ne référence plus un schéma fantôme).

     La baseline est réputée valide quand une base vierge en `synchronize: false`, après application de toutes les migrations dans l'ordre, produit un schéma **strictement identique** à celui que `synchronize: true` génère depuis les entités — vérifié par diff (`pg_dump --schema-only` des deux bases, ou `typeorm schema:log` qui doit ressortir vide après migration). Une baseline qui s'exécute sans erreur mais laisse un `schema:log` non vide n'est pas valide : c'est une seconde source de vérité divergente, pas une capture fidèle du schéma existant.
  2. **`synchronize: false`** partout hors développement local — le schéma n'évolue plus qu'via des migrations versionnées, revues et réversibles.
  3. **Un job CI dédié** qui part d'une base Postgres vierge, applique toutes les migrations dans l'ordre (`synchronize: false`), puis fait tourner la suite e2e complète dessus — seul moyen de garantir que le chemin migration reste correct en continu, plutôt que de redécouvrir sa rupture au prochain lot qui y touche. Même logique que la conversion d'une régression en test rouge appliquée au fix du quota (Lot 5A, session de recette) : rendre la dette impossible à reformer silencieusement, pas seulement la documenter une fois.

Jusqu'à résorption, les migrations écrites (comme `CreateMessagingTables`) restent valides mais ne sont pas exécutées par la CI ; leur correction est vérifiée manuellement — pour le Lot 5B, par un round-trip `up()`/`down()`/`up()` réel contre Postgres, avec vérification par requêtes `psql` fraîches (tables, types enum, contraintes), pas par le seul message de succès du CLI TypeORM.

## Trigger de résorption

Résorber cette dette au premier des deux événements suivants, sans attendre l'autre :

1. **Préparation d'un déploiement en environnement partagé** (staging ou production) — condition strictement bloquante, pas différable.
2. **Le Lot 6**, qui possède `Subscription` et doit y poser l'index unique partiel documenté en dette au Lot 5A (`CREATE UNIQUE INDEX ... ON subscriptions (company_id) WHERE status IN ('trial', 'active')`) : il ne peut le faire proprement par migration que si la baseline existe, sous peine de reproduire exactement l'échec `42P01` observé ici.

**Mise à jour — partiellement résorbé.** La condition 1 (migration baseline, `BaselineSchema1700000000000`) est faite et prouvée : générée depuis les 19 entités préexistantes contre une base vierge (messaging exclu le temps de la génération pour ne pas dupliquer `CreateMessagingTables`), appliquée avec `CreateMessagingTables` dans l'ordre sur cette même base vierge sans erreur (`42P01` ne se reproduit plus), et validée par le critère mécanique ci-dessus : `typeorm schema:log` ressort *« Your schema is up to date »* — aucune requête de synchronisation en attente. Double-preuve par `pg_dump --schema-only` contre une base construite uniquement via `synchronize: true` (toutes entités, `conversations`/`messages` incluses) : aucune différence de schéma applicatif (les deux seuls écarts — le jeton `\restrict`/`\unrestrict` que `pg_dump` régénère aléatoirement à chaque invocation, et la séquence `migrations_id_seq` propre à la table de suivi des migrations, absente côté `synchronize` — sont attendus et sans rapport avec le schéma des entités). `down()` de la baseline également prouvée par round-trip réel (`up` → `down` → `up`), même exigence que pour `CreateMessagingTables` au Lot 5B.

La condition 2 (`synchronize: false` hors dev) était déjà satisfaite par le code applicatif avant même cet ADR (`Joi.boolean().default(false)`, `.env.example`) — seule la CI avait encore `DB_SYNCHRONIZE: 'true'`. `.env.example` commente désormais explicitement cette contrainte avec renvoi vers ce document. Vérifié : la suite e2e complète (37 tests / 8 suites) rejouée avec `DB_SYNCHRONIZE=false` contre une base construite uniquement par les migrations (la même `jobboard_baseline` que ci-dessus) — tous verts, aucune régression liée à l'absence de `synchronize`.

La condition 3 (job CI migration-only) est faite : `.github/workflows/ci.yml` porte désormais un second job, `migration-e2e`, indépendant du `lint-test-build` existant (conservé tel quel, toujours `synchronize: true`) — service Postgres/Redis dédié, base vierge, `DB_SYNCHRONIZE: 'false'`, `npm run migration:run` (baseline puis `CreateMessagingTables`, dans l'ordre) puis `npm run test:e2e` sur le schéma qui en résulte. Reproduit et vérifié en local avant écriture du YAML, avec un rôle/DB recréés à l'identique des credentials du service CI (`jobboard` / `test_password` / base vierge) : les deux migrations s'appliquent sans erreur et la suite e2e complète (37/37) passe sur le schéma qu'elles construisent seules.

**Dette résorbée.** Les trois conditions du trigger 1 sont remplies : la CI empêche désormais que ce chemin se rompe à nouveau sans être détecté, exactement comme demandé. Le trigger 2 (Lot 6) était déjà débloqué depuis la migration baseline — la baseline existe, un futur `AddSubscriptionPartialUniqueIndex` (ou nom équivalent) peut s'appliquer après elle sans `42P01`. Ce document reste la trace de la décision et de son contexte ; il n'est pas révoqué par la résorption de la dette qu'il documentait.

**Dette annexe découverte en vérifiant l'expérience dev locale (non résorbée) — le chemin `docker-compose up --build`.** `docker-compose.yml` fixe déjà `DB_SYNCHRONIZE=false` sur le service `api` (antérieur à ce chantier), mais ni le `Dockerfile` ni `docker-compose.yml` n'exécutent `migration:run` avant le démarrage — sur un volume Postgres vierge, l'app démarre sans schéma. Aggravant : le script `migration:run` actuel dépend de `ts-node`/`tsconfig-paths` (devDependencies), absents de l'image de production (`npm ci --omit=dev` dans le stage `runner`) — il ne fonctionnerait donc pas tel quel dans ce conteneur. Fix correct : exécuter les migrations contre le `data-source` déjà compilé dans `dist/` (imports `.js` résolus nativement par `tsc`, aucun shim `ts-node` requis) plutôt que d'ajouter `ts-node` à l'image prod. Non traité ici (hors périmètre de ce chantier, chemin de démarrage local non affecté) — signalé dans le `README.md` en attendant.

## Conséquences

- **Positif** : la dette est nommée, ses conséquences concrètes (perte de données silencieuse, absence de rollback et d'auditabilité) sont écrites noir sur blanc plutôt que reportées de lot en lot sans jamais être arbitrées ; le prochain lot qui touche au schéma (Lot 6) sait par avance qu'il en dépend et ne redécouvre pas le problème en cours de route.
- **Négatif** : tant que la baseline n'existe pas, toute nouvelle migration écrite après `CreateMessagingTables` hérite de la même limitation (dépendance à un schéma préexistant non gouverné) et ne peut être validée que manuellement, base par base, pas par la CI.
- **Portée** : ce chantier (migration baseline + `synchronize: false` hors dev + job CI migration-only) est un chantier d'infrastructure de release à part entière, pas une tâche d'un lot fonctionnel — à planifier au Lot 0/9 du CDC (socle & durcissement) ou en ticket d'infra dédié.
