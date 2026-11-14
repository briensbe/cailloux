# debordement Specification

## Purpose

Garantir qu'une baisse d'effectif ne fait jamais perdre de saisie : les projets qui ne tiennent plus restent en place et sont signalés, pour que l'utilisateur décide quoi en faire.

## Requirements

### Requirement: Réduire l'effectif sans perte

Réduire l'effectif d'une équipe MUST être toujours possible, et ne MUST ni déplacer, ni redimensionner, ni ranger au bac d'attente les briques existantes.

#### Scenario: Départ d'une personne
- **GIVEN** une équipe de 5 personnes avec une brique sur la 5ᵉ ligne
- **WHEN** l'effectif passe à 4
- **THEN** la brique garde sa position, sa forme et ses dates

### Requirement: Signalement du débordement

Une brique qui occupe au moins une ligne au-delà de l'effectif de son équipe MUST être signalée comme en débordement : elle s'affiche au-dessus du rebord du vase avec un contour d'alerte, le vase indique le nombre de briques en débordement, et l'en-tête signale le débordement toutes équipes confondues.

#### Scenario: Brique en débordement
- **GIVEN** une brique de 2 personnes posée sur les lignes 4 et 5 d'une équipe réduite à 4 personnes
- **THEN** la brique dépasse du rebord avec un contour d'alerte, et le vase et l'en-tête signalent un débordement

#### Scenario: Fin du débordement
- **GIVEN** une brique en débordement
- **WHEN** l'utilisateur la déplace dans le vase ou l'effectif remonte suffisamment
- **THEN** la brique n'est plus signalée

### Requirement: Surcharge

Les cases des briques en débordement MUST compter dans la charge planifiée des périodes qu'elles touchent. Quand la capacité restante d'une période devient négative, elle MUST s'afficher comme une surcharge.

#### Scenario: Capacité restante négative
- **GIVEN** une période où la charge planifiée dépasse la capacité à cause d'une brique en débordement
- **THEN** le vase affiche une surcharge du montant de l'excédent au lieu d'une capacité restante

### Requirement: Les gestes restent bornés par l'effectif

Déplacer, déposer ou redimensionner une brique à la main MUST rester contenu dans l'effectif de l'équipe : aucune brique ne MUST entrer en débordement à la suite d'un geste. En charge fixe, raccourcir une brique MUST buter quand le nombre de personnes nécessaire atteindrait l'effectif. Une brique déposée dans un vase trop étroit pour elle MUST y entrer ramenée à l'effectif, en gardant sa charge (voir la capacité `bac-commun`).

#### Scenario: Raccourcir en charge fixe
- **GIVEN** une brique de 40 j/h en charge fixe dans une équipe de 3 personnes
- **WHEN** l'utilisateur la raccourcit à 2 semaines
- **THEN** elle s'arrête à 3 semaines et 3 personnes

#### Scenario: Déposer une brique trop haute
- **GIVEN** une brique de 60 j/h sur 4 personnes × 3 semaines dans le bac d'une équipe de 3 personnes
- **WHEN** l'utilisateur la fait glisser dans le vase
- **THEN** elle y est posée sur 3 personnes × 4 semaines, garde ses 60 j/h et n'est pas en débordement

### Requirement: Le bac reste un choix

Le bac d'attente MUST ne recevoir que les projets qu'on y range volontairement, ceux qui n'ont trouvé aucune place à leur création ou à leur changement d'équipe, et, pour le bac commun, les projets d'une équipe supprimée : aucune modification de l'effectif ou de la fenêtre ne MUST y envoyer de brique.

#### Scenario: Rangement volontaire
- **WHEN** l'utilisateur dépose une brique dans le bac d'attente
- **THEN** elle perd ses dates et sa position et attend hors du vase

#### Scenario: Équipe supprimée
- **GIVEN** une équipe avec des briques posées
- **WHEN** l'utilisateur supprime cette équipe
- **THEN** ses briques perdent leurs dates et attendent dans le bac commun
