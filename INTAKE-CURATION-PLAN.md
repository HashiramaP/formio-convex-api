# Personnaliser l'intake — activer/désactiver les questions (Phase 1)

**But.** Laisser chaque firme rendre le formulaire client aussi léger qu'elle veut,
en **désactivant** les questions qu'elle préfère ne pas poser — sans perdre la
structure des données (le modèle IMM complet reste là pour la génération PDF, l'auto-
fill, et plus tard l'AI note-taker — voir Phase 2).

**Modèle simple (décidé).** Chaque question est **Demandée** (au formulaire client) ou
**Désactivée** (pas posée du tout). Binaire. Pas de notion « interne » pour l'instant :
la communication technicien ↔ avocat est trop faible pour bâtir une boucle de
remplissage interne maintenant. Une question désactivée est simplement absente du
formulaire ; l'avocat/le technicien récolte cette info hors Formio comme il le fait
déjà. (La notion « à remplir en consultation » + l'AI reviennent en Phase 2.)

UI de référence : maquette `intake-curation-mockup.html`.

## Modèle de données (convex-api)
- **Défaut firme, PAR TYPE DE DEMANDE** : `firms.intakeDisabledFields?: Record<demandeTypeId, string[]>`
  — les externalIds désactivés, séparément pour chaque type de demande. Une même
  question/section peut donc être demandée dans un type et désactivée dans un autre.
  Absent = demandé.
- **Override par client** : `clients.intakeFieldOverrides?: Record<externalId, "ask"|"skip">`.
- **Documents requis, par type de demande** : `firms.requiredDocOverrides?: { [demandeTypeId]:
  { removed: string[], added: Array<{key, label, required, custom?: boolean}> } }`.
  Effectif = (docs dérivés des IMM du bundle − `removed`) + `added`. Les `added` peuvent
  être du catalogue `documents` (OCR) ou personnalisés (label libre, pas d'OCR). Mutation
  `firms.setRequiredDocOverrides({firmId, demandeTypeId, removed, added})`. `getIntakeForClient`
  expose la liste effective des documents (au lieu de seulement l'union des IMM).
- **Quel type de demande pour un client** : stocker `clients.demandeTypeId` quand le
  client vient d'un preset (`attachDemandeToClient`). Client assemblé à la main (sans
  preset) → pas de type → fallback « tout demandé ».
- **État effectif** = `clientOverride[id] ?? (firmDisabled[client.demandeTypeId]?.has(id) ? "skip" : "ask")`.
- Mutations : `firms.setIntakeDisabledFields({firmId, demandeTypeId, externalIds})`,
  `clients.setIntakeFieldOverride({clientId, externalId, state})` (même pattern que
  `documentNamingTemplate`).

## Backend — `getIntakeForClient`
- Filtrer les questions désactivées (effectif = "skip") — exactement comme on filtre
  déjà l'OCR-fillable et les `dependsOn`. Même mécanique, rien de neuf côté wizard.
- `stats` : ajouter `disabledCount` au funnel ; `minClientAnswers` baisse.

## UI de curation — sur le DÉTAIL DU TYPE DE DEMANDE (pas dans Réglages)
La curation vit dans la section « Formulaires », sur le détail d'un type de demande
(voir la réorganisation plus bas) — c'est son foyer naturel puisque la config est
« par type de demande ». Le détail d'un type de demande montre :
- ① Formulaires inclus (IMM) — l'éditeur de preset actuel (cocher les IMM).
- ② **Questions de l'intake** — la curation : questions groupées par section, chacune
  un **interrupteur Demandée / Désactivée**, **« Tout activer/désactiver »** par section,
  résumé live « le client verra N questions · M désactivées », et **« Copier la config
  d'un autre type »**. Enregistrer → `firms.setIntakeDisabledFields[demandeTypeId]`.
- ③ **Documents requis — éditable** (même logique de curation que les questions) :
  liste pré-remplie depuis les `requiredDocuments` des IMM du bundle (dédupliquée),
  chacun **Requis/Optionnel** + **retirable** ; **« + Ajouter un document »** depuis le
  catalogue `documents` (passeport, preuve de fonds, lettre d'invitation, assurance…)
  OU un **document personnalisé** (label libre, sans OCR). Compteur de documents inclus.

## Requête pour la page de curation
La page a besoin de TOUTES les questions d'un type de demande + leur état. Soit une
query dédiée `getIntakeCatalogForDemandeType({demandeTypeId})` (toutes les questions
+ `disabled`), soit on réutilise la liste déjà calculée et on annote. `getIntakeForClient`
reste la version filtrée (côté client).

## Réutilisation (donc peu à bâtir)
- Réglages firme + pattern de mutation (fait pour `documentNamingTemplate`).
- `getIntakeForClient` filtre déjà → on ajoute le filtre « disabled ».
- `skippedSections` (mécanique cousine).
- Le compteur de réduction → les désactivées se soustraient.

## Périmètre Phase 1 (resserré)
- Data (firm disabled set + override client) + filtre `getIntakeForClient` + page de
  curation (interrupteurs + bulk par section + aperçu). **C'est tout.**
- ~Pas~ de vue technicien, pas de remplissage interne (retiré — voir Phase 2).

## Décisions retenues
- **Binaire : Demandée / Désactivée** (pas de « interne » pour l'instant).
- **Niveau** : défaut firme **par type de demande** + override par client.
- **Le défaut = la propre config de la firme**, PAS un preset livré par Formio :
  - 1re fois, jamais configuré → **tout demandé**.
  - La firme désactive + enregistre → ça devient son défaut, réutilisé à chaque client.
  - **Nouveau type de demande** contenant un IMM déjà configuré ailleurs → on **pré-remplit**
    depuis la config existante de la firme pour cet IMM (« Copier depuis [autre type] »
    / « utiliser ma config existante »), puis ajustable. Sinon fallback = tout demandé.
  - Donc la firme configure un IMM ~une fois ; ça se propage comme défaut aux nouveaux
    types qui l'utilisent. Aucun contenu « recommandé » à curer côté Formio.
- **Nouvelle question ajoutée au catalogue plus tard** → demandée par défaut (absente de
  la liste désactivée) ; la firme la désactive si elle n'en veut pas.

## Réorganisation de la section « Formulaires » (`DashboardFormios.tsx`)

État actuel : 4 onglets mélangeant 2 paradigmes. ANCIEN = formulaires custom
(`formDefinitions`/`formQuestions`, éditables via `FormEditor` — onglets « Par défaut »
+ « Mes formulaires »). NOUVEAU = intake indexé par IMM (`legalDocuments.immQuestions`
+ `demandeTypes`, onglets « IMM » lecture-seule + « Demandes »). Problèmes : deux
chemins vers la même soumission ; l'intake IMM **non éditable** dans l'UI (tout par
seed scripts) → la curation n'a pas de foyer ; legacy (base forms, form groups,
section presets, `questionTemplates`, Formiofy) qui n'existe que côté ANCIEN.

**Décision (Parsa) : l'ANCIEN paradigme (formulaires custom) n'est plus utile → on
le CACHE.** Pas en « avancé », juste masqué.
```
Section Formulaires, après :
├─ DEMANDES (types de demande)   ← colonne vertébrale
│   └─[détail d'un type]→  ① IMM inclus (preset actuel)
│                          ② Questions de l'intake → CURATION (Phase 1)
│                          ③ Documents requis
└─ IMM (référence)               → inspecter un IMM seul

CACHÉS : onglets « Par défaut » + « Mes formulaires » + l'éditeur custom (FormEditor).
```
**« Cacher » = ne plus rendre ces onglets/route** dans `DashboardFormios.tsx` (et
masquer/garder la route `FormEditor`). On **ne supprime ni le code ni la data**
(`formDefinitions`/`formQuestions`/`questionTemplates`/base forms restent en place) →
réversible, zéro risque. Suppression réelle = plus tard, si jamais.

**À vérifier avant de cacher :** qu'aucun client *existant* ne dépende encore d'un
formulaire custom comme intake actif (sinon le masquer ne casse rien — la data reste —
mais on veut juste le savoir). Le wizard client IMM (`getIntakeForClient`) ne dépend pas
de l'ancien paradigme.

## Phase 2 (plus tard, hors scope)
Quand la boucle consultation comptera : ré-introduire un 3e état « **à remplir en
consultation** » (le technicien le saisit), puis l'**AI note-taker** (rejoint l'appel /
transcrit → pré-remplit ces champs). Possible *uniquement* grâce à la cible structurée
de la Phase 1. Add-on premium.
