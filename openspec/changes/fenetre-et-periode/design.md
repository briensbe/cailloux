# Design

## Context

Voir `proposal.md` pour la motivation, et les specs `fenetre-de-temps`, `capacite-par-periode` et `debordement` pour le comportement attendu.

État actuel du code :

- `Project` porte `col`/`row` (colonne relative à `PlanningState.startDate`), `Team` porte `size` et `horizon`.
- La géométrie (`domain/geometry.ts`) raisonne dans un repère de grille borné (`Bounds = { weeks, persons }`) : `Occupancy` (summed-area table, cases hors bornes ignorées), `findFirstFit`, `findNearestFree`, `largestFreeRect`, `compact`.
- `PlanningStore.reshapeTeam` envoie au bac les briques qui sortent des nouvelles bornes ; `addProject` les y envoie aussi quand rien ne tient.
- Le `Reservoir` calcule ses indicateurs sur tout l'horizon ; le `DragService` convertit le curseur en `{col, row}` à partir du bas de la grille.
- Le zoom (`ViewService.cellW`, 36 à 110 px) et l'état visuel ne sont pas dans l'historique.

## Goals / Non-Goals

**Goals :**

- Garder la géométrie existante (et ses tests) en la nourrissant de rectangles exprimés **dans le repère de la fenêtre** : la conversion date ↔ colonne se fait à la frontière, pas dans chaque algorithme.
- Calculer les indicateurs de période à partir des briques elles-mêmes, pour que les briques en débordement comptent (surcharge).
- Tout nouveau calcul métier dans `domain/`, avec ses tests.

**Non-Goals :**

- Effectif daté (vase à hauteur variable) : changement suivant.
- Migration des anciennes sauvegardes (ADR 0001).
- Rafraîchir la fenêtre glissante pendant qu'un onglet reste ouvert au passage d'un lundi.

## Decisions

### 1. Modèle : une date de début par brique, une fenêtre dans le planning

- `Project.start: string | null` (lundi ISO `yyyy-mm-dd`) remplace `col`. `row` est conservé. `null` pour les deux = bac d'attente.
- `Team.horizon` est supprimé.
- `PlanningState.startDate` est remplacé par `window: { start: string | null; weeks: number }`. `start = null` signifie « glissante » : le début effectif est calculé à l'ouverture comme le lundi de la semaine en cours. Un décalage manuel écrit un lundi explicite ; « revenir à aujourd'hui » remet `null`.
- La fenêtre vit dans `PlanningState` (donc dans l'historique et la sauvegarde) ; la période sélectionnée et le mode « tout voir » vivent dans `ViewService` (préférences d'affichage, persistées à part comme le zoom).

_Alternative écartée_ : stocker un décalage relatif à la semaine en cours. Un décalage manuel deviendrait lui-même glissant, ce qui contredit l'intention « je regarde telle semaine ».

### 2. Arithmétique des semaines en UTC

Nouvelle fonction `weeksBetween(fromIso, toIso)` dans `domain/weeks.ts`, calculée sur des dates UTC, et `addWeeks(iso, n)`. Calculer sur des dates locales ferait apparaître des journées de 23 ou 25 heures au changement d'heure, et un `Math.floor` pourrait alors décaler une brique d'une semaine.

### 3. Repère de la fenêtre à la frontière

Une fonction pure `toWindowRect(project, windowStart)` donne `{ col: weeksBetween(windowStart, project.start), row, weeks, persons }`. La colonne peut être négative ou dépasser la longueur de la fenêtre : `Occupancy` ignore déjà les cases hors bornes, donc une brique coupée n'occupe que ses cases visibles. `store.occupancy(teamId, exceptId)` construit ses rectangles ainsi, et le store reconvertit une colonne en date (`addWeeks(windowStart, col)`) quand il pose une brique. `DragService.targetAt` et le redimensionnement restent en colonnes, sans changement de logique.

_Alternative écartée_ : réécrire la géométrie en dates absolues. Plus intrusif, sans bénéfice, puisque tout geste a lieu dans la fenêtre visible.

### 4. Bornes des gestes et débordement

Les gestes (déplacement, dépôt, redimensionnement, flèches) restent validés par `Occupancy.isFree` sur les bornes `{ weeks: window.weeks, persons: team.size }` : ni débordement ni dépassement de la fenêtre ne peuvent naître d'un geste. Une brique en débordement est simplement une brique dont `row + persons > size` : `reshapeTeam` ne déplace plus rien, et ne fait que changer `size`. Le vase réserve au-dessus du rebord une hauteur égale au plus grand dépassement de ses briques, pour les dessiner.

### 5. Indicateurs de période calculés par recouvrement

Nouveau module `domain/period.ts` :

- `periodOverlap(project, period)` = nombre de semaines de la brique comprises dans la période.
- charge planifiée = Σ `persons × overlap × 5` sur les briques posées de l'équipe ; air = Σ `air(brique) × overlap / weeks` ; capacité = `size × period.weeks × 5` ; restante = capacité − charge (négative = surcharge) ; taux = charge / capacité.
- charge en attente = Σ des charges des briques du bac ; « tiendrait » = charge en attente ≤ restante.

Les briques ne se chevauchant jamais, sommer leurs surfaces est exact, et c'est ce qui permet de compter les lignes en débordement, qu'une `Occupancy` bornée à l'effectif aurait ignorées.

Pour « le vase est-il plein ? », une `Occupancy` construite sur les bornes de la période (rectangles décalés du début de la période) fournit les cases libres à remplir d'eau et `largestFreeRect` dans la période.

### 6. Placement et tassement à partir de la semaine en cours

`findFirstFit` reçoit une colonne minimale (`fromCol` = indice de la semaine en cours dans la fenêtre, borné à 0). `compact` reçoit la même colonne plancher : les briques dont `col < fromCol` sont des obstacles fixes, les autres ne descendent jamais sous `fromCol`. L'agrandissement « pour faire tenir » cherche le plus petit allongement `k` tel que `findFirstFit` réussisse dans une fenêtre de `weeks + k` (borné par la durée du projet).

### 7. Affichage

- **Tout voir** : `ViewService` calcule `cellW = largeur disponible ÷ window.weeks`, et le zoom manuel autorise alors une largeur inférieure à 36 px. Sous un seuil (container query), la brique n'affiche plus que sa couleur.
- **Briques coupées** : le `Reservoir` dessine l'intersection brique ∩ fenêtre et pose les classes `cut-start`/`cut-end` (bord en zigzag). La poignée de fin est masquée sur un bord coupé.
- **Pastilles hors fenêtre** : calculées par vase (briques avec `col + weeks ≤ 0` ou `col ≥ window.weeks`), plus un total dans l'en-tête.
- **Période** : surbrillance des colonnes de la période, sélection à la souris sur l'axe du temps (même logique de Pointer Events que le drag), et saisie de deux dates ramenées au lundi et au dimanche de leur semaine.

### 8. Nouvelle clé de stockage

`cailloux.state.v2` et une démo réécrite avec des dates relatives au lundi courant, comprenant au moins une brique déjà commencée et une brique hors fenêtre pour montrer les nouveaux signaux.

## Risks / Trade-offs

- [Fenêtres très longues (plusieurs centaines de semaines)] → `largestFreeRect` est en O(W²·H²) ; acceptable jusqu'à quelques centaines de colonnes. Si besoin, le limiter à la période, ce qui est déjà le cas dans la bulle.
- [Briques à la limite de la lisibilité en « tout voir » (~20 px par semaine)] → texte masqué, détail au survol et dans l'inspecteur.
- [Fenêtre glissante figée si l'onglet reste ouvert au passage d'un lundi] → recalcul au prochain chargement ; non bloquant pour un outil de simulation.
- [Perte des sauvegardes v1] → assumée (ADR 0001) : uniquement des données de démo.
- [L'invariant de CLAUDE.md « si ça ne tient pas, ça part au bac » devient faux pour l'effectif et la fenêtre] → mise à jour de CLAUDE.md dans ce changement (ADR 0002).

## Migration Plan

Pas de migration de données : la nouvelle clé de stockage fait repartir de la démo. Retour arrière : redéployer la version précédente, qui relit toujours `cailloux.state.v1`.

## Open Questions

- Faut-il recalculer la fenêtre glissante au retour sur un onglet resté ouvert (événement de visibilité) ? Peut être ajouté plus tard sans toucher aux specs.
