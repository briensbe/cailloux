# Spec Delta

## MODIFIED Requirements

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
