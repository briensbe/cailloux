# capacite-par-periode Specification

## Purpose

Répondre à la question « combien reste-t-il de capacité sur telle période ? » pour chaque équipe et pour l'ensemble, à partir des projets posés dans les vases et de ceux qui attendent dans le bac.

## Requirements

### Requirement: Choix de la période

L'utilisateur MUST pouvoir choisir la période parmi : 3 semaines, 3 mois, 6 mois, 12 mois, ou personnalisée. Une période MUST toujours être faite de semaines entières, du lundi au dimanche. La période par défaut MUST être 3 mois.

#### Scenario: Période par défaut
- **WHEN** l'application s'ouvre pour la première fois
- **THEN** la période sélectionnée est « 3 mois »

### Requirement: Périodes prédéfinies

Les périodes prédéfinies MUST commencer à la semaine en cours et compter respectivement 3, 13, 26 et 52 semaines, quel que soit le décalage de la fenêtre.

#### Scenario: Six mois
- **GIVEN** la semaine en cours commence le 16 novembre 2026
- **WHEN** l'utilisateur choisit « 6 mois »
- **THEN** la période couvre les 26 semaines du 16 novembre 2026 au 16 mai 2027

#### Scenario: Fenêtre décalée
- **GIVEN** une fenêtre décalée de 8 semaines vers le futur
- **WHEN** l'utilisateur choisit « 3 semaines »
- **THEN** la période commence quand même à la semaine en cours

### Requirement: Période personnalisée

L'utilisateur MUST pouvoir définir une période personnalisée en sélectionnant des semaines sur l'axe du temps, ou en saisissant une date de début et une date de fin, ramenées aux semaines entières qui les contiennent. Une période personnalisée MUST pouvoir inclure des semaines passées.

#### Scenario: Saisie de deux dates
- **WHEN** l'utilisateur saisit du mercredi 2 décembre 2026 au mardi 15 décembre 2026
- **THEN** la période couvre les semaines du 30 novembre au 20 décembre 2026

#### Scenario: Sélection sur l'axe
- **WHEN** l'utilisateur fait glisser la souris sur l'axe du temps de la semaine 3 à la semaine 7 de la fenêtre
- **THEN** la période couvre ces 5 semaines

### Requirement: Période visible dans les vases

Les semaines de la période sélectionnée MUST être mises en évidence dans tous les vases.

#### Scenario: Surbrillance
- **WHEN** la période « 3 semaines » est sélectionnée
- **THEN** les 3 colonnes correspondantes sont mises en évidence dans chaque vase

### Requirement: Capacité d'une période

La capacité d'une équipe sur une période MUST valoir son effectif × 5 jours × le nombre de semaines de la période, en jours-homme.

#### Scenario: Calcul simple
- **GIVEN** une équipe de 5 personnes et une période de 13 semaines
- **THEN** sa capacité sur la période vaut 325 j/h

### Requirement: Charge planifiée d'une période

La charge planifiée d'une équipe sur une période MUST compter 5 j/h par case réservée par ses briques dans les semaines de la période, air compris. Une brique à cheval sur la période MUST ne compter que pour ses semaines incluses. Les briques du bac d'attente MUST être exclues.

#### Scenario: Brique à cheval
- **GIVEN** une brique de 2 personnes sur 6 semaines dont 2 semaines tombent dans la période
- **THEN** elle ajoute 20 j/h à la charge planifiée de la période

#### Scenario: L'air compte comme réservé
- **GIVEN** une brique de 13 j/h posée sur 1 personne × 3 semaines, entièrement dans la période
- **THEN** elle ajoute 15 j/h à la charge planifiée, dont 2 j/h d'air

### Requirement: Indicateurs d'une période

Pour chaque équipe et pour l'ensemble des équipes, le système MUST afficher sur la période : la capacité, la charge planifiée et la part d'air qu'elle contient, le taux de remplissage (charge planifiée ÷ capacité) et la capacité restante (capacité − charge planifiée).

#### Scenario: Indicateurs d'une équipe
- **GIVEN** une capacité de 300 j/h et une charge planifiée de 260 j/h dont 10 j/h d'air
- **THEN** le vase affiche un taux de remplissage de 87 %, une capacité restante de 40 j/h et 10 j/h d'air

#### Scenario: Total
- **GIVEN** deux équipes de capacités restantes 40 j/h et 25 j/h sur la période
- **THEN** l'en-tête affiche une capacité restante totale de 65 j/h

### Requirement: Charge en attente

Pour chaque équipe, le système MUST afficher la charge totale des projets de son bac d'attente, et indiquer si cette charge tiendrait dans la capacité restante de la période.

#### Scenario: Ne tiendrait pas
- **GIVEN** une capacité restante de 40 j/h et un bac contenant 60 j/h de projets
- **THEN** le vase affiche 60 j/h en attente avec l'indication « ne tiendrait pas »

### Requirement: Le vase est-il plein sur la période

Demander « Le vase est-il plein ? » MUST remplir d'eau uniquement les cases libres des semaines de la période, et répondre avec la capacité restante de la période et le plus grand rectangle libre contenu dans la période.

#### Scenario: Question sur un trimestre
- **GIVEN** la période « 3 mois » et des cases libres à la fois dans la période et après elle
- **WHEN** l'utilisateur demande si le vase est plein
- **THEN** l'eau ne monte que dans les colonnes de la période, et la réponse ne compte que les cases libres de la période
