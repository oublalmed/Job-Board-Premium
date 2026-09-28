# Vérification de l'école — état & cas de tests

## Est-ce opérationnel ? Oui.

Le workflow complet fonctionne et a été prouvé **en réel** (API locale, comptes
de démo) le 28/09/2026 :

```
SUBMIT   → 201  status=pending  matchedSchool="EHTP — École Hassania des Travaux Publics"
ADMIN    → la soumission apparaît dans la file d'attente (/admin/school-verifications)
APPROVE  → 200  status=verified
PROFIL   → schoolVerified=true, école canonicalisée = "EHTP …"
```

Couverture automatisée : **21 tests** verts
(`school-verification.service.spec.ts` + `grande-ecoles.constant.spec.ts`),
couvrant submit / OCR+match / approve / reject / re-soumission / concurrence.

### Comment ça marche (chaîne réelle)

1. **Candidat** téléverse un justificatif (`POST /candidates/school-verification`,
   PDF/JPEG/PNG). Le fichier est validé (taille, type), **scanné antivirus**,
   stocké, puis passé à l'OCR ; le texte est comparé au référentiel des grandes
   écoles (`grande-ecoles.constant.ts`). Une demande **PENDING** est créée.
2. **Admin/Modérateur** voit la file (`/admin/school-verifications`), ouvre le
   document + le texte OCR + l'école suggérée, puis **approuve** ou **rejette**
   (`PATCH …/verify` | `…/reject`). La décision est atomique (un seul
   réviseur gagne en cas de concurrence).
3. **Approbation** → `candidate_profiles.schoolVerified = true` et l'école du
   profil est canonicalisée sur le nom officiel matché. C'est aussi ce que
   contrôle la garde de publication EF-CAND-06 (un profil ne peut devenir
   visible sans justificatif approuvé).

### ✅ OCR réel (mise à jour)

L'OCR n'est **plus** un stub : `OCR_DRIVER=real` branche un extracteur réel
(`RealOcrAdapter`) qui lit le **contenu réel** du document —

- **PDF** (CV/diplôme exporté en PDF) → couche texte via **pdf-parse** ;
- **Image** (PNG/JPEG scanné) → OCR via **tesseract.js** (fra+eng).

Le texte extrait est comparé au **référentiel des 11 écoles** : **ENSIAS, EMI,
INPT, ENIM, EHTP, INSEA, UM6P, UIR, ENSEM, ESITH, EMSI** (`grande-ecoles.constant.ts`).
Le matcher matche chaque alias **en mot entier** (pas en sous-chaîne), donc
« ensemble » ne matche pas ENSEM ni « académique » EMI.

Prouvé en réel (PDF généré, section *Formation*) :

| Document (PDF) | École reconnue |
| --- | --- |
| CV « … Formation : ENSIAS … » | **ENSIAS** |
| Diplôme EHTP | **EHTP** |
| CV INSEA | **INSEA** |
| CV UIR | **UIR** |
| CV EMSI | **EMSI** |
| École hors référentiel | **aucune (null)** |

Et de bout en bout via l'endpoint (`POST /candidates/school-verification`, PDF) :
`matchedSchool = "ENSIAS — …"`. `OCR_DRIVER=stub` (défaut) reste utilisé en CI
pour garder les tests hermétiques.

---

## 4 cas de tests réels

Comptes : candidats `candidat.*@demo.cobalt.ma`, admin `admin@cobalt.ma`
(mot de passe `Password123!`). Écran candidat : *Mon profil → Vérification de
l'école*. Écran admin : *Vérifications d'écoles*.

### TC1 — Soumission + approbation (chemin nominal) ✅ prouvé en réel
1. Se connecter en candidat, téléverser un justificatif (PDF/PNG).
2. **Attendu** : la demande passe en **PENDING** ; une école est suggérée.
3. Se connecter en admin → la demande est dans la file → **Approuver**.
4. **Attendu** : statut **VERIFIED** ; sur le profil candidat, `schoolVerified`
   devient **true** et l'école affichée est canonicalisée (nom officiel).

### TC2 — Aucune correspondance, l'admin approuve quand même
1. Soumettre un justificatif dont le texte ne matche aucune école du référentiel
   (`matchedSchool = null`).
2. **Attendu** : demande **PENDING** sans école suggérée.
3. Admin → **Approuver**.
4. **Attendu** : `schoolVerified = true`, et l'**école saisie par le candidat
   est conservée** (non écrasée, puisque rien n'a matché).
   *(Couvre : `leaves matchedSchool null…` + approbation sans écrasement.)*

### TC3 — Rejet
1. Soumettre un justificatif → **PENDING**.
2. Admin → **Rejeter** (avec motif).
3. **Attendu** : statut **REJECTED** ; le profil n'est **pas** touché
   (`schoolVerified` reste **false**) ; le candidat peut re-soumettre.
   *(Couvre : `reject() does not touch the candidate profile`.)*

### TC4 — Re-soumission (remplacement propre) ✅ observé en réel
1. Pour un candidat ayant déjà une demande (PENDING, VERIFIED ou REJECTED),
   re-téléverser un nouveau justificatif.
2. **Attendu** : l'ancienne demande **et** son document sont **remplacés** par
   une nouvelle demande **PENDING** (pas d'empilement d'historique ; contrainte
   d'unicité respectée).
   *(Observé : `candidat.sara` est passée de « École Polytechnique » à « EHTP »
   après re-soumission + approbation ; couvre `replaces a previous verification…`.)*

### Garde-fous vérifiés en plus (bonus)
Fichier vide, taille dépassée, type non autorisé (hors PDF/JPEG/PNG), et
**fichier infecté** (antivirus) sont tous **rejetés** à la soumission — 4 tests
dédiés. La double-décision concurrente est protégée (le second réviseur reçoit
un 409 Conflict).
