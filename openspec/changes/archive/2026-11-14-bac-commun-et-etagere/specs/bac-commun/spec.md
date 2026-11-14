# Spec Delta

## Purpose

Garder les projets qu'aucune équipe n'a encore pris dans un bac d'attente partagé par toutes les équipes, à côté du bac de chaque vase, et permettre de les attribuer à une équipe ou de les remettre en commun.

## ADDED Requirements

### Requirement: Projets sans équipe

Un projet MUST pouvoir n'appartenir à aucune équipe. Un tel projet MUST se trouver dans le bac commun, sans dates ni position. Le bac commun et les bacs d'équipe MUST coexister, et chaque projet sans dates MUST être soit dans le bac commun, soit dans le bac d'une équipe.

#### Scenario: Deux sortes de bac
- **GIVEN** un projet « Portail partenaires » sans équipe et un projet « Chatbot support » dans le bac de l'équipe Galets
- **THEN** « Portail partenaires » apparaît dans le bac commun et « Chatbot support » dans le bac de Galets

### Requirement: Dock du bac commun

Le bac commun MUST s'afficher dans un dock fixé en bas de l'écran, visible quel que soit le défilement des vases. Le dock MUST pouvoir être replié en une barre qui garde le nombre de projets et leur charge totale.

#### Scenario: Visible en bas de page
- **GIVEN** quatre équipes dont la dernière est sous le bord de l'écran
- **WHEN** l'utilisateur fait défiler la page jusqu'au dernier vase
- **THEN** le dock du bac commun reste visible en bas de l'écran

#### Scenario: Dock replié
- **GIVEN** un bac commun de 7 projets totalisant 337 j/h
- **WHEN** l'utilisateur replie le dock
- **THEN** seule une barre reste visible, qui indique 7 projets et 337 j/h

### Requirement: Tri des bacs d'attente

Les projets d'un bac d'attente, commun ou d'équipe, MUST s'afficher par charge décroissante. Le système MUST NOT proposer d'ordre de priorité manuel.

#### Scenario: Les gros cailloux d'abord
- **GIVEN** un bac commun contenant des projets de 20, 140 et 45 j/h
- **THEN** ils s'affichent dans l'ordre 140, 45, 20 j/h

### Requirement: Créer un projet dans le bac commun

L'utilisateur MUST pouvoir créer un projet depuis le dock. Ce projet MUST arriver dans le bac commun sans équipe et sans être posé, et son nombre de personnes MUST être borné par l'effectif maximal d'une équipe (30).

#### Scenario: Nouveau caillou sans équipe
- **WHEN** l'utilisateur crée depuis le dock un projet de 90 j/h sur 3 personnes
- **THEN** le projet apparaît dans le bac commun, sans équipe, et aucun vase ne change

### Requirement: Passer d'un bac à l'autre

En mode Vases, l'utilisateur MUST pouvoir glisser une brique du dock vers un vase ou vers le bac d'une équipe, et glisser vers le dock une brique d'un vase ou d'un bac d'équipe. Une brique déposée dans le dock MUST perdre son équipe, ses dates et sa position. L'inspecteur MUST proposer « Aucune (bac commun) » parmi les équipes, avec le même effet.

#### Scenario: Remettre en commun
- **GIVEN** une brique posée dans le vase de Galets
- **WHEN** l'utilisateur la glisse dans le dock
- **THEN** elle apparaît dans le bac commun, sans équipe ni dates, et la place qu'elle occupait est libérée

#### Scenario: Attribuer sans dater
- **GIVEN** un projet du bac commun
- **WHEN** l'utilisateur le glisse dans le bac de l'équipe Silex
- **THEN** il appartient à Silex et attend dans son bac, sans dates

#### Scenario: Par l'inspecteur
- **GIVEN** un projet sélectionné de l'équipe Silex
- **WHEN** l'utilisateur choisit « Aucune (bac commun) » dans la liste des équipes de l'inspecteur
- **THEN** le projet passe au bac commun, sans dates

#### Scenario: Annuler
- **GIVEN** un projet que l'on vient de déposer du dock dans un vase
- **WHEN** l'utilisateur annule (Ctrl+Z)
- **THEN** le projet retrouve sa place dans le bac commun, sans équipe

### Requirement: Entrer dans un vase trop étroit

Quand un projet entre dans un vase dont l'effectif est inférieur à son nombre de personnes, quelle que soit sa provenance, son nombre de personnes MUST être ramené à l'effectif en gardant sa charge, son nombre de semaines étant recalculé, quel que soit son mode de charge. Pendant le glisser, l'aperçu de dépôt MUST montrer la forme recalée.

#### Scenario: Recaler à l'entrée
- **GIVEN** un projet du bac commun de 120 j/h sur 6 personnes × 4 semaines
- **WHEN** l'utilisateur le dépose dans le vase d'une équipe de 4 personnes
- **THEN** le projet est posé sur 4 personnes × 6 semaines et garde ses 120 j/h

#### Scenario: Charge libre conservée
- **GIVEN** un projet en charge libre de 60 j/h sur 4 personnes × 3 semaines
- **WHEN** il entre dans un vase de 2 personnes
- **THEN** il prend 2 personnes × 6 semaines et sa charge reste 60 j/h

#### Scenario: Changement d'équipe par l'inspecteur
- **GIVEN** un projet de 5 personnes de l'équipe Galets
- **WHEN** l'utilisateur choisit l'équipe Silex (3 personnes) dans l'inspecteur
- **THEN** le projet passe à 3 personnes en gardant sa charge, puis il est posé à la première place libre de Silex ou, à défaut, attend dans le bac de Silex

### Requirement: Supprimer une équipe sans perdre ses projets

Supprimer une équipe MUST envoyer tous ses projets, posés ou en attente, au bac commun, sans équipe ni dates, en gardant leur nom, leur charge, leur forme et leur couleur. Un message MUST indiquer combien de projets sont passés au bac commun et proposer d'annuler.

#### Scenario: Suppression de Silex
- **GIVEN** l'équipe Silex avec 4 projets posés et 1 projet dans son bac
- **WHEN** l'utilisateur supprime l'équipe Silex
- **THEN** les 5 projets apparaissent dans le bac commun, et un message propose d'annuler

#### Scenario: Annuler la suppression
- **GIVEN** une équipe que l'on vient de supprimer
- **WHEN** l'utilisateur annule
- **THEN** l'équipe et ses projets retrouvent leurs places et leurs dates

### Requirement: Compatibilité des sauvegardes

Un planning sauvegardé avant l'apparition du bac commun MUST se recharger tel quel, sans perte : tous ses projets gardent leur équipe et le bac commun est vide.

#### Scenario: Ancienne sauvegarde
- **GIVEN** un planning sauvegardé avant cette évolution
- **WHEN** l'utilisateur rouvre l'application
- **THEN** il retrouve ses équipes, ses projets et sa fenêtre, et le bac commun est vide
