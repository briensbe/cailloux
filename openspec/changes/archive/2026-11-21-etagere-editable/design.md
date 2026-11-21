# Design

## Context

Voir `proposal.md` pour la motivation et le périmètre. Techniquement, l'Étagère repose aujourd'hui sur une grille miniature (`SHELF_ROW_H = 16 px` par personne, `shelfCellW()` en largeur) et rend de simples `<div>` sans interaction. `DragService` et `DragOverlay` supposent aujourd'hui l'échelle unique du mode Vases (`CELL_H = 44 px`, `view.cellW()`), et `App` couple l'affichage de l'Inspecteur à `store.selected() !== null`.

## Goals / Non-Goals

**Goals:**
- Réutiliser `DragService`, `DragOverlay` et la logique de redimensionnement à l'échelle active (`activeCellW`, `activeCellH`) sans dupliquer les règles métier de placement ou de capacité.
- Garder l'Inspecteur fermé par défaut lors d'une sélection en mode Étagère, tout en l'ouvrant explicitement sur double-clic ou `Entrée`.
- Préserver la densité visuelle de l'Étagère (briques de `16 px` de haut, en-têtes d'équipe inchangés).

**Non-Goals:**
- Ajouter les boutons d'action d'équipe (renommer, stepper effectif, tasser, eau, supprimer) ou les bacs d'attente d'équipe dans l'Étagère.
- Modifier le comportement du mode Vases (où un simple clic continue d'ouvrir l'Inspecteur).

## Decisions

1. **Dimensions actives centralisées dans `ViewService`**
   - *Choix* : Exposer `activeCellH = computed(() => (this.mode() === 'etagere' ? SHELF_ROW_H : CELL_H))` en complément de `activeCellW` existant, et faire lire `activeCellW()` / `activeCellH()` par `DragService` et `DragOverlay`.
   - *Alternative écartée* : Créer un `ShelfDragService` séparé — dupliquerait l'aimantation, le FLIP et l'autoscroll.

2. **Ouverture explicite de l'Inspecteur en mode Étagère**
   - *Choix* : Ajouter `inspectorOpen = signal(false)` dans `ViewService` (ou un `showInspector` calculé : `mode === 'vases' ? selected !== null : selected !== null && inspectorOpen()`). Passer en Étagère remet `inspectorOpen` à `false` ; sélectionner un autre projet en Étagère garde `inspectorOpen` à `false` tant qu'il n'y a pas double-clic ou `Entrée` ; désélectionner (`Échap` ou clic dans le vide) referme `inspectorOpen`.
   - *Alternative écartée* : Introduire un second signal de sélection dédié à l'Étagère — casserait le partage des raccourcis clavier (`nudge`, `Suppr`, `Ctrl+Z`) et du contour sélectionné.

3. **Poignées de redimensionnement uniquement sur la brique sélectionnée en Étagère**
   - *Choix* : Sur des briques de `16 px` de haut et potentiellement étroites, n'afficher les poignées (`e`, `n`, `ne`) que lorsque la brique est sélectionnée (et rester en capture pointer avec `stopPropagation()` comme en mode Vases).
   - *Alternative écartée* : Poignées permanentes au survol — sur une brique de `16 px × 24 px`, les zones de poignées recouvriraient la zone de saisie du glisser-déposer.

4. **Zones de dépôt sur l'Étagère**
   - *Choix* : Poser `data-drop-kind="grid"` et `[attr.data-drop-team]="l.team.id"` sur chaque `.mini` (ou `.lane`) et `data-grid` sur la zone de grille du vase miniature, pour que `DragService.targetAt()` fonctionne sans connaître la structure DOM spécifique de l'Étagère.

## Risks / Trade-offs

- **Précision du redimensionnement en mode « Tout voir »** : quand `shelfCellW()` est très petit (ex. `6-12 px`), tirer une poignée à la souris reste sensible au pixel → l'Inspecteur (via double-clic / `Entrée`) reste disponible pour un réglage exact.
- **Collision double-clic vs `DragService.press`** : `DragService.press` appelle `store.select(id)` au `pointerup` si le déplacement < `4 px`. Un double-clic déclenche deux `pointerup` suivis d'un `dblclick` natif ; gérer `(dblclick)` sur la brique pour ouvrir l'Inspecteur reste donc naturel et sans conflit avec le glisser-déposer.
