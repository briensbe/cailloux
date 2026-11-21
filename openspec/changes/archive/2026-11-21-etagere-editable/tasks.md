# Tasks

## 1. État d'affichage et échelle active

- [x] 1.1 Ajouter `SHELF_ROW_H` (ou le partager sans cycle), `activeCellH` et `inspectorOpen` (avec `showInspector` calculé : toujours actif en Vases si sélectionné, et seulement sur `inspectorOpen()` en Étagère) dans `src/app/state/view.service.ts` ; vérifier avec `pnpm exec tsc -p tsconfig.app.json --noEmit`.
- [x] 1.2 Adapter `src/app/state/drag.service.ts` et `src/app/ui/drag-overlay.ts` pour utiliser `view.activeCellW()` et `view.activeCellH()` à la place de `view.cellW()` et `CELL_H` ; vérifier que le calcul de `grab`, de la grille cible (`col`, `row`), et de l'aperçu flottant fonctionne aux deux échelles (`pnpm exec tsc -p tsconfig.app.json --noEmit`).

## 2. Ouverture du dock, du clavier et de l'Inspecteur à la demande

- [x] 2.1 Retirer le verrou `readOnly` dans `src/app/ui/dock/dock.ts` (ou le supprimer s'il ne sert plus) afin que le bouton `+` et le glisser-déposer fonctionnent aussi en Étagère ; vérifier le comportement du dock dans `dock.html`.
- [x] 2.2 Dans `src/app/app.ts`, `src/app/app.html` et `src/app/ui/inspector/inspector.ts` / `inspector.html` :
  - Activer les raccourcis clavier (`Ctrl+Z/Y`, `Échap`, `← ↑ → ↓`, `Suppr`/`Retour arrière`) en mode Étagère et ajouter `Entrée` pour ouvrir l'Inspecteur quand une brique est sélectionnée.
  - Piloter l'ouverture de l'Inspecteur via `view.showInspector()` (et fermer `inspectorOpen` lors d'un clic sur le bouton de fermeture de l'Inspecteur ou lors de la désélection).
  - Mettre à jour le libellé d'infobulle du bouton « Étagère » dans `app.html`.

## 3. Interaction sur l'Étagère (glisser-déposer, sélection, redimensionnement)

- [x] 3.1 Dans `src/app/ui/etagere/etagere.ts`, `etagere.html` et `etagere.scss` :
  - Ajouter `data-drop-kind="grid"`, `[attr.data-drop-team]="l.team.id"` et `data-grid` sur chaque vase miniature, ainsi que le rendu du fantôme d'aimantation (`drag.drag()?.target`).
  - Brancher `(pointerdown)` sur les briques via `drag.press(...)`, `(dblclick)` pour ouvrir l'Inspecteur (`view.openInspector()`), et le clic dans le vide de la grille pour désélectionner.
  - Afficher l'état sélectionné (`.is-selected`) et les poignées de redimensionnement (`e`, `n`, `ne`) sur la brique sélectionnée, avec redimensionnement à l'échelle `cw()` / `SHELF_ROW_H` et aperçu en direct (`resizing` signal).

## 4. Vérification

- [x] 4.1 Lancer `pnpm test -- --watch=false`, `pnpm exec tsc -p tsconfig.app.json --noEmit` et `pnpm exec ngc -p tsconfig.app.json --noEmit` et vérifier que tous les tests et la compilation passent sans erreur.
