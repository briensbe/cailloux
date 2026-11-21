# Spec Delta

## REMOVED Requirements

### Requirement: Lecture seule
**Reason**: L'Étagère devient éditable de façon ciblée (bac commun, déplacement, redimensionnement et raccourcis clavier) tout en conservant une ouverture manuelle du détail projet.
**Migration**: Remplacé par les exigences d'édition ciblée sur l'Étagère (`Bac commun actif sur l'Étagère`, `Déplacement de briques sur l'Étagère`, `Redimensionnement de briques sur l'Étagère`, `Sélection et détail projet à la demande`).

## ADDED Requirements

### Requirement: Bac commun actif sur l'Étagère

En mode Étagère, le dock du bac commun MUST permettre de créer un nouveau projet dans le bac commun, de glisser un projet du bac commun vers un vase miniature et de déposer un projet de l'Étagère dans le bac commun.

#### Scenario: Création depuis le dock sur l'Étagère
- **WHEN** l'utilisateur clique sur le bouton d'ajout dans le dock alors que l'Étagère est affichée
- **THEN** le dialogue de création d'un projet dans le bac commun s'ouvre

#### Scenario: Placement depuis le dock vers un vase miniature
- **WHEN** l'utilisateur glisse un projet du dock vers un vase miniature de l'Étagère
- **THEN** le projet est placé dans ce vase à la semaine et la ligne aimantées

#### Scenario: Retour au bac commun depuis l'Étagère
- **WHEN** l'utilisateur glisse un projet d'un vase miniature de l'Étagère vers le dock
- **THEN** le projet rejoint le bac commun

### Requirement: Déplacement de briques sur l'Étagère

L'utilisateur MUST pouvoir déplacer une brique sur l'Étagère par glisser-déposer (dans le même vase ou d'une équipe à une autre) et au clavier sur la brique sélectionnée (`← ↑ → ↓`, `Suppr`, `Échap`, `Ctrl+Z` / `Ctrl+Y`).

#### Scenario: Glisser-déposer inter-équipes sur l'Étagère
- **WHEN** l'utilisateur glisse une brique du vase d'une équipe vers le vase d'une autre équipe sur l'Étagère
- **THEN** un aperçu d'aimantation s'affiche dans le vase cible et le projet change d'équipe à l'endroit lâché

#### Scenario: Déplacement au clavier sur l'Étagère
- **WHEN** une brique est sélectionnée sur l'Étagère et que l'utilisateur appuie sur une flèche directionnelle
- **THEN** la brique se déplace d'une case dans la direction demandée

### Requirement: Redimensionnement de briques sur l'Étagère

L'utilisateur MUST pouvoir redimensionner une brique sélectionnée sur l'Étagère depuis ses poignées afin d'ajuster sa durée en semaines et son nombre de personnes.

#### Scenario: Redimensionnement en largeur sur l'Étagère
- **WHEN** l'utilisateur tire la poignée droite d'une brique sélectionnée sur l'Étagère
- **THEN** la durée en semaines du projet s'ajuste en temps réel à l'échelle de l'Étagère

### Requirement: Sélection et détail projet à la demande

En mode Étagère, un simple clic sur une brique MUST la sélectionner sans ouvrir automatiquement le panneau Inspecteur. L'utilisateur MUST pouvoir ouvrir l'Inspecteur à la demande par un double-clic sur une brique ou par la touche `Entrée` lorsqu'une brique est sélectionnée.

#### Scenario: Simple clic sans ouverture de l'Inspecteur
- **WHEN** l'utilisateur clique une brique sur l'Étagère
- **THEN** la brique est sélectionnée et le panneau Inspecteur reste fermé

#### Scenario: Ouverture à la demande par double-clic ou Entrée
- **WHEN** l'utilisateur double-clique sur une brique de l'Étagère ou appuie sur `Entrée` avec une brique sélectionnée
- **THEN** le panneau Inspecteur s'ouvre pour ce projet
