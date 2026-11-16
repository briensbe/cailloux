# Design

## Context

Voir `proposal.md` pour la motivation, et le delta de la spec `import-projets` pour le comportement attendu.

État actuel du code :

- L'import Excel (change archivé `import-bac-commun`) a posé les bases : `nameKey` (`domain/names.ts`) pour l'identité par le nom, `Project.meta`, un aperçu dont toute la logique est une fonction pure du domaine (`reviewImport`) recalculée à chaque choix, `PlanningStore.importProjects` en un seul `commit()`, et le dock qui lit le fichier puis ouvre l'aperçu via un signal de `ViewService`.
- Les briques sont datées (ADR 0001) : `start` (lundi ISO) et `row`, converties en colonnes de la fenêtre par `toWindowRect`. `canOccupy` (`domain/geometry.ts`) valide un rectangle qui peut commencer avant le bord gauche ; `findNearestFree` (l'aimant) cherche aussi dans le temps et ne regarde que les colonnes ≥ 0, ce qui ne convient pas ici.
- `periodFigures` compte la charge planifiée en cases entières, air compris. Le composant `Brick` dessine déjà l'air en hachuré.
- Le JSON exporté (vue « resource ») contient `metadonnees`, `synthese`, `projets[]` (nom, code, référenceExterne, statut, chefProjet, couleur, `chiffres`, `chargesParSemaine`, `equipes[]` avec ressources et planifications commentées), `equipes[]` et `arborescenceVue`. Les deux exports réels ont 12 et 47 projets, 1 à 3 équipes (Artémis, Aurora, BRSU), une seule équipe et un seul rôle par projet, aucun effectif d'équipe, des charges de 0,2 à 3 j par semaine, et 15 projets sans aucune semaine planifiée.

## Goals / Non-Goals

**Goals :**

- Toute la décision (cibles, états, actions, simulation de la pose, nouvel état) en fonctions pures du domaine, testées. L'aperçu montre exactement ce que l'import fera, parce qu'il affiche le résultat de la même simulation.
- Aucune nouvelle notion dans `PlanningState` : des équipes, des projets et des métadonnées, comme aujourd'hui.

**Non-Goals :**

- Lire `synthese` ou `arborescenceVue` : tout ce qu'il faut est dans `projets[]`.
- Retenir l'export pour le comparer plus tard : chaque import compare le fichier à l'état courant, sans historique des exports.
- Garder la répartition semaine par semaine comme donnée structurée : elle n'est conservée qu'en métadonnée texte.

## Decisions

### 1. Lecture défensive de l'export, dans le domaine

`domain/planning-export.ts` expose `parsePlanningExport(data: unknown): PlanningExport | null`. Le JSON vient d'un autre outil : on vérifie chaque champ utile au lieu de faire confiance au type, et on renvoie `null` si `projets` ou `equipes` ne sont pas des tableaux.

```ts
interface PlanningExport {
  teams: string[];                       // noms, dans l'ordre du fichier
  projects: ExportedProject[];
}
interface ExportedProject {
  name: string;                          // nettoyé par cleanName
  team: string | null;                   // première équipe du projet (un seul rôle, hors périmètre au-delà)
  load: Record<string, number>;          // lundi ISO -> jours, valeurs > 0 seulement
  meta: Record<string, string>;          // code, référence externe, statut, chef de projet, chiffres, commentaires
}
```

Les semaines sont ramenées au lundi avec `mondayIso`, par sécurité. Un projet sans nom est ignoré. Si deux projets ont le même `nameKey`, seul le premier est retenu (même règle que l'import Excel).

_Alternative écartée_ : typer le JSON tel quel (`as PlanningJson`). Un export d'une autre version de l'outil casserait alors loin de la lecture, dans l'interface.

### 2. Cible : la partie à venir, une personne, toute la durée

`targetOf(project, today): Target | null` ne garde que les semaines ≥ `today` (le lundi de la semaine en cours, `store.today`). Si aucune ne reste, il n'y a pas de cible. Sinon :

```
start  = première semaine à venir      weeks  = weeksBetween(start, dernière) + 1
charge = somme des jours à venir       persons = 1
```

La charge peut être bien inférieure à `weeks × 5` : c'est l'air de la brique. Le projet garde le **mode libre** : un redimensionnement à la main refera suivre la charge à la surface, ce qui est le comportement attendu d'un geste explicite.

Les dimensions sont posées directement, sans passer par `withWeeks` ou `freeResize`. Comme pour une création, il n'y a pas de forme précédente à transformer : ce n'est pas une opération de forme au sens des invariants de `CLAUDE.md`.

_Alternative écartée_ : le mode « charge fixe ». `withWeeks` borne alors la durée entre « toute l'équipe » et « une personne » pour la charge : une brique de 0,6 j/h sur 5 semaines serait ramenée à 1 semaine au premier geste.

### 3. Comparaison : `reviewPlanning`, sur le même modèle que `reviewImport`

```ts
reviewPlanning(exp: PlanningExport, state: PlanningState, today: string, choices: PlanningChoices): PlanningReview
```

`PlanningChoices` ne contient que ce que l'utilisateur change : l'effectif des équipes à créer, et l'action choisie par ligne quand elle diffère du défaut. Le dialogue le garde dans des signals et recalcule la revue avec un `computed()`.

Pour chaque projet de l'export, dans l'ordre du fichier :

| Situation | État | Action par défaut | Autres actions |
|---|---|---|---|
| pas de cible, toutes semaines passées | `ended` (sans suite) | `none` | — |
| pas de cible, aucune semaine | `unplanned` | `toTray` si au bac commun ou absent, sinon `none` | `none`, `toTray` |
| cible, absent de Cailloux | `new` | `place` | `toTray`, `none` |
| cible, au bac commun ou au bac de l'équipe cible | `toPlace` | `place` | `none` |
| cible, posé conforme, ou au bac d'une autre équipe | `upToDate` ou `drift` | `none` | `align` (pour `drift`) |

« Conforme » : même équipe (par `nameKey`), même `start`, même `weeks`, `|charge - cible| ≤ 0,1`. La ligne ne compte pas. Un `drift` décrit ce qui diffère (équipe, début, durée, charge) pour l'affichage.

La revue liste aussi les projets **absents de l'export** (équipe présente dans le JSON, nom absent) et les **équipes à créer** (nom sans correspondance par `nameKey`).

### 4. Simulation de la pose : ligne la plus basse à la colonne exacte

La revue simule les poses pour annoncer l'issue de chaque ligne (`placed` sur la ligne n, ou `tray`). L'ordre est déterministe :

1. Fenêtre : si une cible à poser finit après le bord droit, `extraWeeks = max(fin) - window.weeks`. Le calcul tient compte des seules actions retenues.
2. Par équipe, on part des rectangles de **toutes** les briques posées. Un alignement ne libère que sa propre brique pendant qu'on lui cherche une place : il la remplace s'il en trouve une, sinon elle reste où elle était. Ainsi, aucune autre ligne ne peut prendre une place qu'un alignement raté devrait garder, et le résultat ne contient jamais de chevauchement.
3. On traite d'abord les lignes `align`, puis les lignes `place`, chaque groupe par début croissant puis par nom. Pour chacune, on cherche `row` de 0 à `effectif - 1` tel que `canOccupy({ col, row, weeks, persons: 1 }, rects, bounds)`, où `col = weeksBetween(windowStart, start)` (éventuellement négatif) et `bounds.weeks = window.weeks + extraWeeks`. On ajoute le rectangle trouvé aux occupés.
4. Pas de ligne : issue `tray` pour `place` (le projet va au bac de son équipe, sans dates). Pour `align`, issue `unchanged` : un alignement impossible ne défait pas une pose existante (ADR 0002), et l'aperçu le dit.

L'effectif d'une équipe à créer vient des choix. Tant qu'il n'est pas saisi, la revue ne simule pas les poses de cette équipe, et le bouton « Appliquer » est désactivé.

_Alternative écartée_ : réutiliser `findNearestFree`. Il décale les dates (sa distance compte les colonnes) et ignore les colonnes négatives.

### 5. Application : une fonction pure qui produit le nouvel état

```ts
applyPlanning(state: PlanningState, review: PlanningReview, newId: (prefix: string) => string): PlanningState
```

Elle crée les équipes, agrandit la fenêtre, puis applique chaque issue : création, pose (`teamId`, `start`, `row`, forme cible), envoi au bac d'équipe (`teamId`, `start = row = null`, charge = `restant` si positif, sinon charge actuelle, ou 5 j/h pour un nouveau projet), ou alignement. Elle fusionne les métadonnées (`{ ...existantes, ...json }`). Le générateur d'identifiants est injecté pour que les tests soient déterministes.

`PlanningStore.applyPlanning(review)` se contente de `commit(applyPlanning(...))` et d'un message récapitulatif avec « Annuler ». L'opération ne fait qu'un seul `commit()`, donc un seul Ctrl+Z. Elle sort tout de suite si aucune action n'est retenue.

Un projet créé reçoit une pierre d'après la couleur du JSON (`nearestStone`), sinon la rotation de son équipe. Un projet existant garde la sienne.

_Alternative écartée_ : enchaîner les méthodes existantes du store (`addTeam`, `moveProject`…). Chacune ferait son propre `commit()`, donc autant de Ctrl+Z, et rien ne garantirait que le résultat soit celui de la simulation.

### 6. Métadonnées issues du JSON

Les clés reprennent les libellés de l'export Excel quand ils existent : « Code Projet », « Référence Externe », « Statut », « Chef de Projet », « Couleur ». S'y ajoutent « Chiffres » (`initial 100 · révisé 100,3 · prévisionnel 100,3 · consommé 20,7 · restant 79,7`), « Semaines planifiées » (`07/12 : 1 · 14/12 : 1 · … (14 semaines, 12 j)`, partie à venir seulement) et « Commentaires » (`07/12 : Accessibilité · …`). Ce sont des textes lisibles, affichés par la section « Métadonnées » existante de l'inspecteur.

### 7. Interface

- **Dock** : l'`accept` du sélecteur devient `.xlsx,.json`. `open(file)` choisit le lecteur selon l'extension. Pour un `.json` : `JSON.parse`, `parsePlanningExport`, puis `ViewService.planningSource.set({ fileName, export })`, ou un message si le fichier n'est pas un export.
- **`ui/planning-dialog/`** : un `<dialog>` modal comme l'aperçu Excel, avec :
  - en en-tête, le fichier, les compteurs par état et les équipes à créer, chacune avec un champ d'effectif ;
  - au corps, un groupe repliable par équipe, puis une ligne par projet : nom, état, cible (dates, semaines, j/h), écart éventuel (« Cailloux 11/01 · JSON 07/12 »), issue de la simulation (« ligne 2 », « bac de l'équipe »), et un `<select>` d'action quand plusieurs actions sont possibles ;
  - en pied, le récapitulatif (« 31 posés · 2 au bac d'équipe · 1 équipe créée · fenêtre +1 semaine ») et « Appliquer ».
  - Les projets absents de l'export sont listés à la fin de leur équipe, sans action.

## Risks / Trade-offs

- [Avec des briques d'une personne sur toute la durée, le remplissage compte des lignes plutôt que des jours (Artémis : 495 j/h de cases pour 67,8 j planifiés)] → C'est le choix assumé de la forme A. L'air hachuré montre la densité réelle de chaque brique, et le glossaire est mis à jour.
- [Un export d'une autre version de l'outil change de forme] → Lecture défensive et message clair, sans toucher au planning.
- [Le calcul de `today` dépend de l'horloge : un même fichier ne donne pas les mêmes cibles d'une semaine à l'autre] → C'est voulu (partie à venir). Les tests passent `today` en paramètre.
- [Un nom partagé par deux projets dans Cailloux, l'unicité n'étant contrôlée qu'à l'import] → On rapproche du premier trouvé, et l'aperçu signale l'ambiguïté. Ce cas reste rare.
- [Simulation coûteuse à chaque frappe dans un champ d'effectif] → Au plus quelques centaines de briques, avec `canOccupy` en O(n) par essai : négligeable. On ne recalcule qu'au `change` du champ.

## Migration Plan

Aucune : pas de nouveau champ dans `PlanningState`, la clé de stockage ne change pas. Retour arrière : les projets posés par l'import restent des briques ordinaires.
