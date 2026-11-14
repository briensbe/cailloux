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
  - `weeks.ts` : semaines ISO qui commencent le lundi, libellés en `fr-FR`.
- **`state/`** : services `providedIn: 'root'` construits sur des signals.
  - `PlanningStore` est la **seule source de vérité**. Toute écriture passe par `commit()`, qui empile l'état précédent pour Ctrl+Z (80 niveaux) ; un `effect` sauvegarde ensuite dans `localStorage` (`cailloux.state.v1`).
  - `ViewService` contient l'état purement visuel (zoom `cellW`, dialogue ouvert). Il n'entre **pas** dans l'historique.
  - `DragService` gère le glisser-déposer à la main avec les Pointer Events (ni drag HTML5, ni CDK) ; la cible est trouvée grâce aux attributs `data-drop-team`, `data-drop-kind="tray"`, `data-grid` et `data-brick-id` du DOM. L'atterrissage est animé en FLIP.
- **`ui/`** : composants standalone, `OnPush`, `input()`/`computed()`. `Reservoir` correspond à un vase, `Brick` à un projet, `Inspector` au panneau latéral et `ProjectDialog` à « Nouveau caillou ».

## Invariants à respecter

- **État immuable** : ne jamais muter `Project`, `Team` ou `PlanningState` en place. Il faut produire un nouvel objet (`{ ...p, ... }`), sinon l'annulation et les signals cessent de fonctionner. Une action qui ne change rien doit sortir tôt, sans appeler `commit()`, pour ne pas polluer l'historique (c'est le motif suivi par toutes les méthodes du store).
- **Pas de chevauchement** : on ne pose une brique qu'à une case validée par `Occupancy.isFree`, `findFirstFit` ou `findNearestFree`. Si aucune place n'existe, la brique passe dans le bac (`col = row = null`) et un toast prévient l'utilisateur. Elle n'est jamais forcée dans le vase.
- **Axe Y inversé** : `row = 0` est le **fond** du vase, alors que le DOM compte depuis le haut. Les conversions pixel ↔ case (voir `DragService.targetAt`) partent de `box.bottom`.
- `Occupancy` exclut la brique déplacée grâce à `store.occupancy(teamId, exceptId)`. Si on l'oublie, la brique entre en collision avec elle-même.
- Pour construire un `Rect` candidat, recopier explicitement `weeks`/`persons` (voir `at()` dans `geometry.ts`). Écrire `{ col, row, ...project }` laisserait les `col`/`row` du projet écraser ceux du candidat.
- Calculs sur les charges : passer par `weeksFor`/`personsFor`, qui retranchent un `EPSILON` avant `Math.ceil` pour corriger les erreurs d'arrondi des flottants.
- Modes de redimensionnement : `free` (la charge suit la surface) et `fixed` (surface imposée). Toute nouvelle opération de forme doit passer par `withWeeks`, `withPersons`, `withCharge` ou `freeResize` et traiter les deux modes.
- Accès à `localStorage` : toujours dans un `try/catch`, car l'application doit fonctionner sans stockage. Si le format de `PlanningState` change, changer la clé de stockage ou ajouter une migration dans `loadState()`. Sinon les anciens états, validés seulement de façon superficielle, seront chargés tels quels.

## Conventions

- Code, commentaires, libellés et messages de commit en **français**. L'interface emploie le vocabulaire de la métaphore (vase, caillou, gravier, sable, bac d'attente, « secouer le vase »).
- Les dimensions des cases sont exposées en variables CSS `--cell-w` / `--cell-h` sur `app-root`. `CELL_H = 44` px est fixe ; seule la largeur change avec le zoom (36 à 110).
- Locale `fr-FR` enregistrée dans `app.config.ts` : les pipes affichent `12,5` et non `12.5`.
- Les raccourcis clavier globaux sont définis dans `App.onKey`. Ils ne s'appliquent pas quand le focus est dans un champ ou un `dialog`.
- Déploiement GitHub Pages : uniquement manuel (`workflow_dispatch`), Node 24.
