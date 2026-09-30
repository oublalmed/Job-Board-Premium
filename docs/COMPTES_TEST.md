# Comptes de test — Cobalt

Jeu de données de test généré par `npm run seed:testcases`
(voir [`src/database/seed-testcases.ts`](../src/database/seed-testcases.ts)).

> **Mot de passe unique pour TOUS les comptes : `Password123!`**

- **Frontend** : http://localhost:3001
- **API** : http://localhost:3000 (docs Swagger : http://localhost:3000/api/v1/docs)

Le script **vide toute la base** (schéma conservé) sauf le **catalogue
d'évaluations** (spécialités + tests), puis recrée le jeu ci-dessous. Rejouable
à tout moment ; refuse de tourner en production sans `SEED_FORCE=1`.

---

## Admin / Modérateur

| Email | Rôles | Accès |
|---|---|---|
| `admin@test.cobalt.ma` | admin + modérateur | Espace `/admin` complet (analytics, packs, vérification écoles, modération, abonnements…) |

*(Ajouté pour ne pas verrouiller l'espace admin après le wipe — ne fait pas partie des 3 cas de test demandés.)*

---

## Recruteurs (3 entreprises, 1 pack chacune)

Chaque recruteur a les rôles **recruteur + admin entreprise**. Abonnements **actifs**.

| Email | Entreprise | Pack | Quota contacts | Fonctionnalités clés débloquées |
|---|---|---|---|---|
| `recruteur.starter@test.cobalt.ma` | Atlas RH | **Starter** | 15 | CVthèque, recherche, évaluations, analytics de base. **Pas** de Jobs, **pas** d'anti-triche. |
| `recruteur.pro@test.cobalt.ma` | Maghreb Tech | **Pro** | 60 | + **Jobs**, candidatures, shortlist, export. Pas d'anti-triche ni d'analytics avancées. |
| `recruteur.premium@test.cobalt.ma` | Zellige Labs | **Premium** | 200 | + **Anti-triche** + **analytics avancées**. |

### Gating attendu (vérifié en direct)

- Starter → `/recruiter/jobs` renvoie **403** (`FEATURE_NOT_AVAILABLE`), pas d'onglet Jobs exploitable.
- Anti-triche : visible/opérationnelle **uniquement** pour Zellige Labs (Premium) ; 403 pour Starter/Pro.
- Analytics recruteur (`/analytics`) : disponible pour les 3 (pack de base), données réelles scoping entreprise.

---

## Candidats (3 profils complets)

Profils complets, indexés dans la CVthèque, école vérifiée, 1 évaluation terminée avec score.

| Email | Nom | École | Compétences | Score (tech / psycho → global) | Note |
|---|---|---|---|---|---|
| `candidat.ensias@test.cobalt.ma` | Sara Benali | **ENSIAS** | Node.js, PostgreSQL, Docker | 88 / 82 → **85.6** | — |
| `candidat.emi@test.cobalt.ma` | Youssef El Amrani | **EMI** | React, TypeScript, Node.js | 74 / 69 → **72.0** | **Signaux anti-triche** (4 changements d'onglet) → niveau **medium** côté recruteur Premium |
| `candidat.inpt@test.cobalt.ma` | Imane Tazi | **INPT** | Python, SQL, Spark | 80 / 77 → **78.8** | — |

> **OCR** : le champ « école » est renseigné directement par le seed (état post-OCR).
> Pour tester l'OCR réel, importe un CV depuis l'espace candidat → l'école est
> détectée et comparée à la liste de référence (ENSIAS, EMI, INPT, ENIM, EHTP,
> INSEA, UM6P, UIR, ENSEM, ESITH, EMSI).

---

## Offres d'emploi (Jobs)

Seules les entreprises Pro & Premium peuvent publier (Starter = 0 offre autorisée).

| Entreprise | Offre | Statut | Détails |
|---|---|---|---|
| Maghreb Tech (Pro) | Développeur Full-Stack (React / Node.js) | **Publiée** | Casablanca · CDI · Confirmé · React, Node.js, TypeScript |
| Maghreb Tech (Pro) | Stage PFE — Data | **Brouillon** | Rabat · PFE · Junior · Python, SQL |
| Zellige Labs (Premium) | Ingénieur Backend Node.js | **Publiée** | Rabat · CDI · Senior · Node.js, PostgreSQL, Docker |

### Candidatures déposées

| Candidat | Offre | Statut |
|---|---|---|
| Sara (ENSIAS) | Ingénieur Backend Node.js (Zellige) | Candidature envoyée |
| Youssef (EMI) | Développeur Full-Stack (Maghreb) | Présélectionné |
| Imane (INPT) | Développeur Full-Stack (Maghreb) | Candidature envoyée |
| Imane (INPT) | Ingénieur Backend Node.js (Zellige) | En cours d'examen |

### Shortlist

- **Zellige Labs (Premium)** : Sara Benali
- **Maghreb Tech (Pro)** : Youssef El Amrani

---

## Réinitialiser / régénérer

```bash
npm run seed:testcases
```

Recrée exactement ce jeu (nouveaux identifiants, mêmes emails/mots de passe).
