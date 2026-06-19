# Phase 2 — L'intelligence d'intake (le killer feature) — NOTÉ, PAS COMMENCÉ

> Figé pendant qu'on construit la Phase 1 (manipulation des forms). Ne pas démarrer
> tant que la Phase 1 n'est pas dans les mains des users.

## L'idée en une phrase
Le cabinet **garde sa propre intake form** ; Formio la **mappe** sur le catalogue
canonique, **l'audite** (quoi enlever / quoi ajouter / score), puis **pré-remplit les
IMM** par-dessous. Adoption à coût zéro (« on ne change pas leur workflow »).

## Ce ne sont PAS 4 features — c'en est UNE
« AI raider » + « AI amélioreur » + « score » + « questions manquantes » = **un seul
moteur (le mapping), avec plusieurs sorties.**

## Le pipeline (un seul build, deux payoffs)
```
1. INGÉRER  → importer la form du cabinet (Word/PDF)      [l'import existe déjà, à rebrancher]
2. MAPPER   → l'IA relie chaque question au catalogue     [LE socle, net-new]
              canonique ; le consultant valide une fois
   ├─ 3. AUDITER  (acquisition / lead magnet)
   │     - redondantes : extractibles des docs (OCR) → arrête de les poser
   │     - manquantes : couverture vs les IMM du type de demande
   │     - score : complétude/qualité de l'intake
   └─ 4. GÉNÉRER  (rétention)
         - toggle « pose ma form, pas les questions IMM »
         - les réponses de leur form remplissent les IMM
```
- **Audit = acquisition** (lead magnet : « Laisse Formio analyser ton intake form »).
- **Génération = rétention** (la valeur qui les garde).
- Les deux reposent sur l'étape 2 (mapping).

## Pourquoi c'est défendable
L'audit n'est possible **que grâce au moat** : catalogue canonique mappé +
`documents.fills` (quelle question chaque doc OCR-remplit) + mapping type→IMM. Un form
builder générique ne peut pas le produire. **C'est la monétisation du moat.**

## Briques qui existent déjà (≈80 %)
- catalogue canonique `questions` + `legalDocuments.immQuestions` = « ce que chaque IMM exige »
- `documents.fills` = détection des questions redondantes (OCR)
- `demandeTypes` = type de demande → quels IMM
- `getIntakeForClient.stats` = funnel dédup/OCR (matière au score)
- `ImportFormDialog` + Gemini = ingestion (à rebrancher sur le catalogue, pas créer des clés synthétiques)
- La comparaison manuelle 5484 vs VRT (déjà faite par Parsa) = la sortie « manques », à automatiser

## Net-new
- (a) couche de mapping IA (question importée → externalId) + **UX de validation**
- (b) présentation de l'audit + **barème de score défendable**
- (c) flux public lead-magnet (tourner sans compte)
- (d) câblage génération depuis les réponses de la form importée

## Le non-négociable (où ça foire)
**Tout repose sur le mapping.** Mauvais mapping ⇒ l'audit ment (détruit la confiance
au moment de l'acquisition) ET la génération remplit les mauvais champs (casse le moat).
- L'audit lead-magnet doit être **conservateur et juste** sur une form froide.
- Le score a besoin d'un **barème défendable** (couverture IMM + potentiel OCR + dédup), pas un chiffre vanité.
- Trade-off à assumer : amener leur form **bypasse** dédup/OCR/moins-de-questions. OK pour qui tient à sa form.

## MVP (dé-risquer le mapping AVANT de parier le marketing)
1. **Interne** : 1 form importée + 1 type (visa visiteur) → l'IA mappe → audit (redondantes/manques/score). Parsa vérifie l'exactitude sur 3-4 vraies forms.
2. Si le mapping tient → **exposer l'audit en lead magnet**.
3. **Ensuite seulement** → câbler la génération (même mapping, déjà prouvé).

## Décision déjà prise
Traiter ça comme **« un moteur de mapping, sorti d'abord en audit (acquisition), puis
en génération (rétention) »**. Audit d'abord.
