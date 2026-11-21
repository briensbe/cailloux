# Proposal

## Why

La vue Étagère permet de comparer la charge de toutes les équipes sur une même règle du temps, mais elle est actuellement figée en lecture seule. L'utilisateur ne peut ni y placer un projet du bac commun, ni déplacer un projet d'une semaine ou d'une équipe à l'autre, ni le redimensionner directement sans quitter l'Étagère pour revenir en mode Vases.

## What Changes

- Activer le bac commun (dock) en mode Étagère : création d'un projet (`+`), glisser-déposer vers un vase miniature de l'Étagère et dépôt d'un projet de l'Étagère vers le bac commun.
- Permettre le glisser-déposer des briques sur l'Étagère (changement de semaine, de ligne ou d'équipe) à l'échelle miniature, avec fantôme d'aimantation et animation d'atterrissage.
- Permettre le redimensionnement direct d'une brique sélectionnée sur l'Étagère à l'échelle miniature (durée en semaines et effectif en personnes).
- Activer les raccourcis clavier sur l'Étagère (`← ↑ → ↓` pour pousser une brique sélectionnée, `Suppr`/`Retour arrière`, `Échap`, `Ctrl+Z` / `Ctrl+Y`).
- Dissocier la sélection de l'ouverture du panneau de détail (Inspecteur) en mode Étagère : un simple clic sélectionne la brique sans ouvrir l'Inspecteur ; un double-clic sur la brique ou la touche `Entrée` sur une brique sélectionnée l'ouvre à la demande.
- Conserver les en-têtes et bacs d'attente d'équipe sans contrôles d'édition supplémentaires afin de garder l'Étagère épurée.

## Capabilities

### New Capabilities

### Modified Capabilities
- `etagere`: Remplacer l'exigence « Lecture seule » par une édition ciblée (bac commun, déplacement, redimensionnement, raccourcis clavier) avec ouverture manuelle du détail projet (double-clic ou `Entrée`).

## Impact

- `src/app/state/view.service.ts` : hauteur de ligne active (`activeCellH`) et gestion de l'ouverture explicite de l'Inspecteur en mode Étagère (sans effacer la sélection ou avec fermeture de l'Inspecteur à la demande).
- `src/app/state/drag.service.ts` et `src/app/ui/drag-overlay.ts` : calcul du glisser-déposer et de l'aperçu flottant à partir des dimensions actives (`activeCellW`, `activeCellH`).
- `src/app/ui/etagere/` (`etagere.ts`, `etagere.html`, `etagere.scss`) : zones de dépôt par vase, briques interactives (clic, double-clic, glisser, poignées de redimensionnement sur sélection, fantôme d'aimantation).
- `src/app/ui/dock/dock.ts` : lever le mode `readOnly` en Étagère.
- `src/app/app.ts`, `src/app/app.html` : activer les raccourcis clavier (dont `Entrée` pour ouvrir l'Inspecteur) et conditionner l'ouverture de l'Inspecteur en mode Étagère.
