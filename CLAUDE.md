# CLAUDE.md

Cailloux : application Angular 21 sans backend qui montre la capacité des équipes sous forme de vases remplis de briques (projets).
Le [README.md](README.md) décrit le produit, les commandes et le déploiement. Ce fichier contient ce qu'il faut savoir avant de modifier le code.

## Commandes

- `pnpm start` : serveur de dev sur le port 4200. La config de lancement de Claude ([.claude/launch.json](.claude/launch.json)) utilise le port **4300**.
- `pnpm test` : Vitest via `ng test`. Seul `src/app/domain` est testé. `describe`/`it`/`expect` sont des globales, sans import.
- `pnpm build` : sortie dans `dist/cailloux/browser`. Budgets de production : 500 kB initial (avertissement), **12 kB de style par composant** (avertissement) et 20 kB (erreur).
- Utiliser pnpm, pas npm : la version est fixée par `packageManager`, et seul `pnpm-lock.yaml` est à jour.
- Prettier : 100 colonnes, guillemets simples, parser `angular` pour les `.html`.

## Architecture (trois couches, dépendances dans un seul sens : ui → state → domain)

- **`domain/`** : TypeScript pur, sans import Angular. C'est le seul code testé, donc toute nouvelle règle métier va ici, avec son test.
  - `capacity.ts` : conversions charge ↔ semaines × personnes. **1 case = 1 personne × 1 semaine = 5 j/h** (`DAYS_PER_WEEK`).
  - `geometry.ts` : collisions et placement. `Occupancy` pré-calcule une summed-area table, ce qui permet de tester un rectangle en O(1). `findFirstFit`, `findNearestFree` (aimant), `largestFreeRect`, `compact` (« secouer le vase »).
  - `weeks.ts` : semaines ISO qui commencent le lundi, libellés en `fr-FR`. Les écarts entre dates (`weeksBetween`, `addWeeks`) se calculent en UTC pour ne pas être faussés par le changement d'heure.
  - `window.ts` : la fenêtre de semaines et le passage date ↔ colonne (`toWindowRect`), le repérage des briques hors fenêtre ou en débordement, l'agrandissement minimal pour faire tenir un projet.
  - `period.ts` : la période d'analyse et ses indicateurs (capacité, charge planifiée, air, taux de remplissage, capacité restante, charge en attente). Vocabulaire : [GLOSSARY.md](GLOSSARY.md).
- **`state/`** : services `providedIn: 'root'` construits sur des signals.
  - `PlanningStore` est la **seule source de vérité**. Toute écriture passe par `commit()`, qui empile l'état précédent pour Ctrl+Z (80 niveaux) ; un `effect` sauvegarde ensuite dans `localStorage` (`cailloux.state.v2`). La fenêtre (`window`) fait partie de cet état : elle s'annule avec Ctrl+Z.
  - `ViewService` contient l'état purement visuel (zoom, mode « tout voir », période sélectionnée, dialogue ouvert), retenu dans `cailloux.view.v1`. Il n'entre **pas** dans l'historique. `cellW` est calculé : zoom, ou largeur ajustée en « tout voir ».
  - `DragService` gère le glisser-déposer à la main avec les Pointer Events (ni drag HTML5, ni CDK) ; la cible est trouvée grâce aux attributs `data-drop-team`, `data-drop-kind="tray"`, `data-grid` et `data-brick-id` du DOM. L'atterrissage est animé en FLIP.
- **`ui/`** : composants standalone, `OnPush`, `input()`/`computed()`. `Reservoir` correspond à un vase, `Brick` à un projet, `Inspector` au panneau latéral et `ProjectDialog` à « Nouveau caillou ».

## Invariants à respecter

- **État immuable** : ne jamais muter `Project`, `Team` ou `PlanningState` en place. Il faut produire un nouvel objet (`{ ...p, ... }`), sinon l'annulation et les signals cessent de fonctionner. Une action qui ne change rien doit sortir tôt, sans appeler `commit()`, pour ne pas polluer l'historique (c'est le motif suivi par toutes les méthodes du store).
- **Briques datées** (ADR 0001) : une brique stocke sa semaine de début (`start`, un lundi ISO) et sa ligne (`row`) ; `start = row = null` = bac d'attente. La géométrie travaille en colonnes de la fenêtre : convertir avec `store.windowRect(p)` / `toWindowRect`, et repasser en date avec `addWeeks(windowStart, col)`. Une colonne peut être négative (projet commencé avant la fenêtre) ou au-delà de la fenêtre.
- **Pas de chevauchement** : on ne pose une brique qu'à une place validée par `Occupancy.isFree`, `findFirstFit`, `findNearestFree` ou, pour une brique déjà posée qui peut déborder sur le passé, `store.canOccupy`. Les gestes restent bornés par l'effectif et le bord droit de la fenêtre.
- **Ne jamais perdre une saisie** (ADR 0002) : réduire l'effectif ou raccourcir la fenêtre ne déplace rien et n'envoie rien au bac ; les briques sont signalées en débordement ou hors fenêtre. Le bac ne reçoit que les dépôts volontaires et les projets qui n'ont trouvé aucune place à leur création (avec un toast). Supprimer une équipe envoie ses projets au bac commun, sans leurs dates (`removeTeam`).
- **Bac commun** (ADR 0003) : `teamId = null` = projet du bac commun, toujours avec `start = row = null`. `store.projectsOf(teamId)` ne renvoie jamais ces projets ; passer par `store.commonProjects`. Écrire `moveProject(id, null, null)` pour remettre un projet en commun.
- **Entrée dans un vase** : un projet qui entre dans une équipe (dépôt, bac d'équipe, inspecteur, `placeProject`) passe par `fitToTeam` : s'il est plus haut que l'effectif, il y est ramené en gardant sa charge. `moveProject` l'applique lui-même ; pour chercher une place, recaler d'abord la forme (le `DragService` et `moveToTeam` le font).
- **Le passé ne bouge pas tout seul** : placements et « Tasser » partent de la semaine en cours (`store.todayCol()`), et `compact` laisse en place les briques commencées avant. À la main, tout reste déplaçable.
- **Axe Y inversé** : `row = 0` est le **fond** du vase, alors que le DOM compte depuis le haut. Les conversions pixel ↔ case (voir `DragService.targetAt`) partent de `box.bottom`.
- `Occupancy` exclut la brique déplacée grâce à `store.occupancy(teamId, exceptId)`. Si on l'oublie, la brique entre en collision avec elle-même.
- Pour construire un `Rect` candidat, recopier explicitement `weeks`/`persons` (voir `at()` dans `geometry.ts`). Écrire `{ col, row, ...project }` laisserait les `col`/`row` du projet écraser ceux du candidat.
- Calculs sur les charges : passer par `weeksFor`/`personsFor`, qui retranchent un `EPSILON` avant `Math.ceil` pour corriger les erreurs d'arrondi des flottants.
- Modes de redimensionnement : `free` (la charge suit la surface) et `fixed` (surface imposée). Toute nouvelle opération de forme doit passer par `withWeeks`, `withPersons`, `withCharge` ou `freeResize` et traiter les deux modes.
- Accès à `localStorage` : toujours dans un `try/catch`, car l'application doit fonctionner sans stockage. Si le format de `PlanningState` change, changer la clé de stockage (aujourd'hui `cailloux.state.v2`) ou ajouter une migration dans `loadState()`. Sinon les anciens états, validés seulement de façon superficielle, seront chargés tels quels.

## Conventions

- Code, commentaires, libellés et messages de commit en **français**. L'interface emploie le vocabulaire de la métaphore (vase, caillou, gravier, sable, bac d'attente, « secouer le vase »).
- Les dimensions des cases sont exposées en variables CSS `--cell-w` / `--cell-h` sur `app-root`. `CELL_H = 44` px est fixe ; seule la largeur change, avec le zoom (12 à 110) ou le mode « tout voir ».
- Locale `fr-FR` enregistrée dans `app.config.ts` : les pipes affichent `12,5` et non `12.5`.
- Les raccourcis clavier globaux sont définis dans `App.onKey`. Ils ne s'appliquent pas quand le focus est dans un champ ou un `dialog`.
- Déploiement GitHub Pages : uniquement manuel (`workflow_dispatch`), Node 24.
