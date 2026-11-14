# fenetre-de-temps Specification

## Purpose

Montrer les vases sur une fenêtre de semaines commune à toutes les équipes, assez longue pour voir l'année d'un coup, où chaque projet garde ses vraies dates quoi qu'on fasse de la fenêtre.

## Requirements

### Requirement: Briques ancrées sur une date

Chaque brique posée dans un vase MUST retenir sa semaine de début réelle (un lundi). Décaler, allonger ou raccourcir la fenêtre ne MUST jamais modifier les dates d'une brique.

#### Scenario: La fenêtre glisse sans déplacer les projets
- **GIVEN** une brique qui commence la semaine du 16 novembre 2026
- **WHEN** la fenêtre est décalée d'une semaine vers la droite
- **THEN** la brique commence toujours la semaine du 16 novembre 2026 et s'affiche une colonne plus à gauche

### Requirement: Fenêtre commune à tous les vases

Le système MUST afficher tous les vases sur une même fenêtre de semaines consécutives. Les équipes n'ont plus d'horizon propre : leur seule dimension réglable est leur effectif.

#### Scenario: Deux équipes partagent la fenêtre
- **WHEN** deux équipes sont affichées
- **THEN** leurs vases couvrent exactement les mêmes semaines, dans les mêmes colonnes

### Requirement: Fenêtre glissante par défaut

La fenêtre MUST commencer par défaut le lundi de la semaine en cours, et avancer d'elle-même quand une nouvelle semaine commence. Une nouvelle installation MUST avoir une fenêtre de 52 semaines.

#### Scenario: Ouverture un nouveau lundi
- **GIVEN** une fenêtre non décalée, ouverte pour la dernière fois la semaine précédente
- **WHEN** l'utilisateur rouvre l'application un lundi
- **THEN** la fenêtre commence ce lundi-là

### Requirement: Décalage manuel de la fenêtre

L'utilisateur MUST pouvoir décaler le début de la fenêtre semaine par semaine, vers le futur comme vers le passé, puis revenir à la semaine en cours en une action.

#### Scenario: Regarder le passé
- **WHEN** l'utilisateur décale la fenêtre de 4 semaines vers le passé
- **THEN** la fenêtre commence 4 semaines avant la semaine en cours et les briques de ces semaines sont visibles et déplaçables

#### Scenario: Revenir à aujourd'hui
- **GIVEN** une fenêtre décalée
- **WHEN** l'utilisateur choisit « revenir à aujourd'hui »
- **THEN** la fenêtre recommence à la semaine en cours et glisse de nouveau d'elle-même

### Requirement: Longueur de la fenêtre ajustable

L'utilisateur MUST pouvoir allonger ou raccourcir la fenêtre d'une semaine à la fois, sans autre limite qu'une semaine au minimum. La longueur MUST être sauvegardée avec le planning et annulable comme toute autre modification.

#### Scenario: Allonger d'une semaine
- **GIVEN** une fenêtre de 52 semaines
- **WHEN** l'utilisateur ajoute une semaine
- **THEN** tous les vases couvrent 53 semaines

#### Scenario: Annuler un raccourcissement
- **GIVEN** une fenêtre raccourcie de 52 à 40 semaines
- **WHEN** l'utilisateur annule (Ctrl+Z)
- **THEN** la fenêtre retrouve 52 semaines

### Requirement: Raccourcir la fenêtre sans perte

Raccourcir la fenêtre ne MUST ni déplacer, ni redimensionner, ni ranger au bac d'attente les briques qui dépassent : elles gardent leurs dates et deviennent hors fenêtre.

#### Scenario: Une brique au-delà du nouveau bord
- **GIVEN** une brique qui occupe les semaines 45 à 50 d'une fenêtre de 52 semaines
- **WHEN** la fenêtre est raccourcie à 40 semaines
- **THEN** la brique garde ses dates, n'est pas dans le bac, et est signalée comme hors fenêtre

### Requirement: Brique coupée par un bord de la fenêtre

Une brique dont une partie tombe hors de la fenêtre MUST s'afficher coupée net au bord concerné, avec un signe visuel indiquant qu'elle continue hors de vue, et ses vraies dates MUST être consultables au survol.

#### Scenario: Projet déjà commencé
- **GIVEN** une brique commencée 2 semaines avant le début de la fenêtre
- **WHEN** le vase s'affiche
- **THEN** seule la partie dans la fenêtre est dessinée, avec un bord gauche marqué « continue », et le survol donne sa vraie date de début

### Requirement: Signalement des briques entièrement hors fenêtre

Quand des briques d'une équipe tombent entièrement avant ou après la fenêtre, le vase MUST afficher sur le bord concerné leur nombre et, au survol, leurs noms. Une action sur ce signal MUST décaler ou allonger la fenêtre juste assez pour les montrer. L'en-tête MUST afficher le nombre total de briques hors fenêtre, toutes équipes confondues.

#### Scenario: Projets au-delà du bord droit
- **GIVEN** 3 briques de l'équipe Galets entièrement après la fin de la fenêtre
- **WHEN** le vase s'affiche
- **THEN** le bord droit du vase indique 3 projets hors de vue et l'en-tête signale des projets hors fenêtre

#### Scenario: Ramener les projets à l'écran
- **WHEN** l'utilisateur active le signal du bord droit
- **THEN** la fenêtre est allongée juste assez pour que ces briques soient entièrement visibles

### Requirement: Vue de toute la fenêtre

L'utilisateur MUST pouvoir faire tenir toute la fenêtre dans la largeur de l'écran. Les briques trop étroites pour leur texte MUST rester identifiables par leur couleur et donner leur détail au survol. Le zoom manuel existant MUST rester disponible.

#### Scenario: Voir l'année
- **GIVEN** une fenêtre de 52 semaines plus large que l'écran
- **WHEN** l'utilisateur active « tout voir »
- **THEN** les 52 semaines sont visibles sans défilement horizontal

### Requirement: Placement d'un nouveau projet dans la fenêtre

Un nouveau projet MUST être posé à la première place libre de la fenêtre à partir de la semaine en cours (au plus tôt, puis au plus près du fond). S'il ne tient nulle part, la création MUST proposer d'allonger la fenêtre juste assez pour qu'il tienne, en plus de le ranger au bac d'attente.

#### Scenario: Gros projet trop long pour la fenêtre
- **GIVEN** une fenêtre dont aucune place libre ne peut accueillir le projet
- **WHEN** l'utilisateur prépare ce projet dans « Nouveau caillou »
- **THEN** l'aperçu annonce que le vase déborde et propose d'agrandir la fenêtre

#### Scenario: Agrandir pour faire tenir
- **WHEN** l'utilisateur choisit d'agrandir la fenêtre
- **THEN** la fenêtre est allongée du nombre minimal de semaines et le projet est posé dans le vase, pas dans le bac

### Requirement: Le bord droit borne les gestes

Déplacer ou redimensionner une brique à la main MUST rester contenu dans la fenêtre : une brique ne MUST pas être étirée ni déposée au-delà de son dernier bord, et la fenêtre ne MUST pas s'agrandir d'elle-même pendant ces gestes.

#### Scenario: Étirer contre le bord
- **GIVEN** une brique qui touche la dernière semaine de la fenêtre
- **WHEN** l'utilisateur tire sa poignée de droite plus loin
- **THEN** la brique ne s'allonge pas et la fenêtre garde sa longueur

### Requirement: Le passé est simulable

Toute brique MUST pouvoir être déplacée et redimensionnée à la main, y compris quand elle commence avant la semaine en cours, et une brique MUST pouvoir être déposée dans des semaines passées visibles dans la fenêtre.

#### Scenario: Déplacer un projet commencé
- **GIVEN** une fenêtre décalée vers le passé et une brique commencée il y a 3 semaines
- **WHEN** l'utilisateur la fait glisser d'une semaine vers la droite
- **THEN** sa date de début avance d'une semaine

### Requirement: Tasser à partir de la semaine en cours

« Tasser » MUST faire glisser les briques vers la semaine en cours et vers le fond du vase sans jamais les faire commencer avant la semaine en cours, et MUST laisser en place les briques qui commencent déjà avant elle.

#### Scenario: Un projet commencé reste en place
- **GIVEN** une brique commencée 2 semaines avant la semaine en cours et une brique future séparée d'elle par un trou
- **WHEN** l'utilisateur tasse le vase
- **THEN** la brique commencée ne bouge pas et la brique future avance sans commencer avant la semaine en cours

### Requirement: Nouveau format de sauvegarde

Le planning MUST être sauvegardé sous un nouveau format, distinct de l'ancien. Un planning sauvegardé dans l'ancien format MUST être ignoré, et l'application MUST alors partir d'une démo au nouveau format.

#### Scenario: Ancienne sauvegarde présente
- **GIVEN** un navigateur qui contient un planning à l'ancien format uniquement
- **WHEN** l'application s'ouvre
- **THEN** elle affiche la démo, avec des briques datées et une fenêtre de 52 semaines
