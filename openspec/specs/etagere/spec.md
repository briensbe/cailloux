# etagere Specification

## Purpose

Comparer d'un coup d'œil la charge de toutes les équipes sur une même règle du temps, et voir où il reste de la place toutes équipes confondues, sans quitter les principes des vases et des cailloux.

## Requirements

### Requirement: Deux modes d'affichage

L'utilisateur MUST pouvoir passer du mode Vases à l'Étagère et inversement depuis la barre d'outils. Le mode choisi MUST être retenu d'une visite à l'autre et MUST NOT entrer dans l'historique d'annulation. Le mode Vases MUST rester inchangé.

#### Scenario: Basculer
- **GIVEN** le mode Vases
- **WHEN** l'utilisateur choisit « Étagère » dans la barre d'outils
- **THEN** tous les vases s'affichent en miniature sur l'Étagère, et Ctrl+Z ne revient pas au mode Vases

#### Scenario: Mode retenu
- **GIVEN** l'Étagère affichée
- **WHEN** l'utilisateur recharge la page
- **THEN** l'Étagère s'affiche à nouveau

### Requirement: Vases miniatures

L'Étagère MUST montrer chaque vase en miniature, avec les mêmes briques aux mêmes semaines et lignes, dans les mêmes couleurs. La hauteur de chaque vase MUST rester proportionnelle à son effectif. Le nom, la charge et la forme d'une brique MUST être lisibles au survol.

#### Scenario: Hauteur proportionnelle
- **GIVEN** une équipe de 8 personnes et une équipe de 2 personnes
- **THEN** sur l'Étagère, le vase de la première est quatre fois plus haut que celui de la seconde

#### Scenario: Survol d'une brique
- **WHEN** l'utilisateur survole une brique miniature
- **THEN** il lit son nom, sa charge, son nombre de personnes et son nombre de semaines

### Requirement: Une seule règle du temps

Tous les vases de l'Étagère MUST partager une même règle du temps et un même défilement : une semaine donnée MUST être à la même abscisse dans tous les vases. La règle MUST rester visible pendant le défilement vertical. La ligne de la semaine en cours et la surbrillance de la période MUST traverser tous les vases.

#### Scenario: Semaines alignées
- **GIVEN** une brique de Galets et une brique de Silex qui commencent la même semaine
- **THEN** sur l'Étagère, leurs bords gauches sont alignés à la verticale

### Requirement: En-têtes des équipes

À gauche de chaque vase miniature, l'Étagère MUST afficher le nom de l'équipe, son effectif et, sur la période sélectionnée, une jauge de remplissage, le taux de remplissage et la capacité restante, ou la surcharge si elle est négative.

#### Scenario: Indicateurs d'une équipe
- **GIVEN** une équipe de 5 personnes remplie à 83 % sur la période, avec 55 j/h restants
- **THEN** son en-tête affiche « 5 p », une jauge à 83 %, « 83 % » et « reste 55 j/h »

### Requirement: Personnes libres, toutes équipes

Au-dessus de la règle du temps, l'Étagère MUST afficher, pour chaque semaine de la fenêtre, le nombre de personnes libres toutes équipes confondues, sous forme de barres alignées sur les semaines des vases. Une semaine sans aucune personne libre MUST être signalée. Le bac commun MUST NOT entrer dans ce décompte. Cette bande MUST n'exister que sur l'Étagère.

#### Scenario: Semaine saturée
- **GIVEN** une semaine où tous les vases sont pleins
- **THEN** la barre de cette semaine est signalée comme sans personne libre

#### Scenario: Somme des vases
- **GIVEN** une semaine où Galets a 1 personne libre et Silex 2
- **THEN** la barre de cette semaine vaut 3 personnes libres

### Requirement: Signalements sur l'Étagère

L'Étagère MUST reprendre les signalements du mode Vases : briques en débordement au-dessus du rebord avec un contour d'alerte, briques coupées par un bord de la fenêtre, nombre de briques entièrement hors fenêtre de chaque côté du vase, nombre de briques en débordement dans l'en-tête de l'équipe.

#### Scenario: Débordement en miniature
- **GIVEN** une brique de l'équipe Quartz au-dessus de son effectif
- **THEN** sur l'Étagère, la brique dépasse du rebord du vase miniature avec un contour d'alerte, et l'en-tête de Quartz signale le débordement

### Requirement: Bacs d'équipe sur l'Étagère

Pour chaque équipe dont le bac contient des projets, l'en-tête MUST afficher leur nombre et leur charge totale, à titre d'information.

#### Scenario: Pastille d'attente
- **GIVEN** l'équipe Galets avec 1 projet de 40 j/h dans son bac
- **THEN** son en-tête affiche « 1 en attente · 40 j/h »

### Requirement: Zoom de l'Étagère

L'Étagère MUST avoir son propre zoom horizontal, indépendant de celui du mode Vases, et MUST s'ouvrir par défaut en faisant tenir toute la fenêtre dans la largeur.

#### Scenario: Zooms indépendants
- **GIVEN** un zoom réglé au maximum en mode Vases
- **WHEN** l'utilisateur passe sur l'Étagère, puis revient au mode Vases
- **THEN** l'Étagère montre toute la fenêtre dans la largeur, et le mode Vases retrouve son zoom maximal

### Requirement: Lecture seule

L'Étagère MUST être en lecture seule : aucun geste ne MUST y déplacer, redimensionner, sélectionner, créer ou supprimer une brique, ni renvoyer vers le mode Vases. Le dock du bac commun MUST y rester visible et repliable, mais en lecture seule : ni glisser, ni création.

#### Scenario: Aucun geste
- **GIVEN** l'Étagère affichée
- **WHEN** l'utilisateur clique sur une brique, la fait glisser ou appuie sur une flèche
- **THEN** le planning ne change pas et l'affichage reste sur l'Étagère

#### Scenario: Dock en lecture seule
- **GIVEN** l'Étagère affichée
- **WHEN** l'utilisateur essaie de glisser une brique du dock
- **THEN** rien ne bouge, et le bouton de création du dock est inactif
