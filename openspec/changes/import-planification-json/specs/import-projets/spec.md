# Spec Delta

## MODIFIED Requirements

### Requirement: Ouvrir un fichier à importer

En mode Vases, l'utilisateur MUST pouvoir importer un fichier `.xlsx` ou un export JSON de planification (`.json`) de deux façons : en le déposant sur le dock du bac commun, ou avec un bouton « Importer… » du dock. Un `.xlsx` MUST ouvrir l'aperçu d'import, un `.json` l'aperçu de comparaison. Le dock MUST s'éclairer pendant qu'un fichier le survole. En mode Étagère, l'import MUST NOT être proposé.

#### Scenario: Dépôt sur le dock
- **GIVEN** le mode Vases
- **WHEN** l'utilisateur glisse un fichier `.xlsx` depuis son explorateur de fichiers et le lâche sur le dock
- **THEN** l'aperçu d'import s'ouvre avec les lignes du fichier

#### Scenario: Bouton Importer
- **WHEN** l'utilisateur clique sur « Importer… » dans le dock et choisit un fichier `.xlsx`
- **THEN** l'aperçu d'import s'ouvre avec les lignes du fichier

#### Scenario: Export JSON
- **GIVEN** le mode Vases
- **WHEN** l'utilisateur dépose sur le dock un export JSON de planification
- **THEN** l'aperçu de comparaison s'ouvre, regroupé par équipe

#### Scenario: Étagère en lecture seule
- **GIVEN** le mode Étagère
- **WHEN** l'utilisateur lâche un fichier sur le dock
- **THEN** rien n'est importé et aucun aperçu ne s'ouvre

### Requirement: Fichier illisible

Si le fichier n'est ni un `.xlsx` lisible ni un export JSON de planification valide, ou si la première feuille d'un `.xlsx` n'a pas de colonne de nom, le système MUST l'indiquer par un message et MUST NOT modifier le planning.

#### Scenario: Mauvais format
- **WHEN** l'utilisateur dépose un fichier PDF sur le dock
- **THEN** un message indique que le fichier n'a pas pu être lu, et le planning est inchangé

#### Scenario: Pas de colonne de nom
- **GIVEN** un fichier `.xlsx` dont la première ligne ne contient ni « Nom Projet » ni « Nom »
- **WHEN** l'utilisateur l'importe
- **THEN** un message indique qu'aucune colonne de nom n'a été trouvée, et le planning est inchangé

#### Scenario: JSON d'une autre forme
- **GIVEN** un fichier `.json` sans liste `projets` ni liste `equipes`
- **WHEN** l'utilisateur l'importe
- **THEN** un message indique que ce n'est pas un export de planification, et le planning est inchangé

## ADDED Requirements

### Requirement: Cible d'un projet planifié

Pour chaque projet d'un export JSON ayant des semaines planifiées à venir (à partir de la semaine en cours), le système MUST calculer une cible : son équipe, une brique d'une personne allant de la première à la dernière semaine planifiée à venir, et pour charge le total des jours planifiés à venir. Les semaines passées MUST être ignorées.

#### Scenario: Partie à venir seulement
- **GIVEN** la semaine en cours du 16 novembre 2026, et « C Bourse - Offre ACCESS » planifié chaque semaine du 26 octobre au 28 décembre, soit 6 j/h à partir du 16 novembre
- **THEN** sa cible commence le 16 novembre, dure 7 semaines sur 1 personne et porte 6 j/h

#### Scenario: Semaines éparses
- **GIVEN** « Maintenance » planifié pour 0,3 j les semaines du 7 décembre et du 4 janvier, et rien entre les deux
- **THEN** sa cible va du 7 décembre au 4 janvier (5 semaines, 1 personne) et porte 0,6 j/h ; le reste de la brique est de l'air

### Requirement: État de chaque projet

Chaque projet du JSON MUST être rapproché des projets existants par son nom, et MUST recevoir un état : nouveau, à poser, à jour, écart, non planifié ou sans suite. Un projet est « à jour » s'il est posé dans l'équipe cible, avec le même début, la même durée et la même charge à 0,1 j/h près ; sa ligne n'entre pas en compte.

#### Scenario: À poser
- **GIVEN** « Offre crypto » dans le bac commun, et planifié dans le JSON
- **THEN** l'aperçu le marque « à poser »

#### Scenario: À jour
- **GIVEN** un projet déjà posé dans l'équipe, à la date, à la durée et à la charge de sa cible, sur la troisième ligne du vase
- **THEN** l'aperçu le marque « à jour »

#### Scenario: Écart
- **GIVEN** « ECO294 » posé dans Artémis à partir du 11 janvier, alors que sa cible commence le 7 décembre
- **THEN** l'aperçu le marque « écart » et indique les deux dates

#### Scenario: Sans suite
- **GIVEN** un projet dont toutes les semaines planifiées sont avant la semaine en cours
- **THEN** l'aperçu le marque « sans suite »

### Requirement: Actions par défaut

Chaque état MUST avoir une action par défaut, modifiable ligne par ligne. Nouveau : créer et poser. À poser : prendre la forme cible et poser. À jour : aucune. Écart : laisser tel quel, avec l'option « aligner sur le JSON ». Non planifié : aller au bac de son équipe s'il est dans le bac commun ou absent, sinon aucune. Sans suite : aucune.

#### Scenario: Écart laissé par défaut
- **GIVEN** un projet en écart
- **WHEN** l'utilisateur applique l'import sans rien changer
- **THEN** le projet garde son équipe, sa place et sa forme

#### Scenario: Aligner sur le JSON
- **GIVEN** un projet en écart pour lequel l'utilisateur choisit « aligner sur le JSON »
- **WHEN** il applique l'import
- **THEN** le projet prend l'équipe, le début, la durée et la charge de sa cible

#### Scenario: Non planifié vers le bac de l'équipe
- **GIVEN** « C BOURSE - Souscription PIP ETF Selfcare » dans le bac commun, sans semaine planifiée dans le JSON, dans l'équipe Aurora
- **WHEN** l'utilisateur applique l'import
- **THEN** le projet est dans le bac d'Aurora, sans dates

### Requirement: Pose à date exacte

Un projet posé par l'import MUST commencer à la semaine de sa cible, sur la ligne libre la plus basse sur toute sa durée ; ses dates MUST NOT être décalées. S'il n'y a aucune ligne libre, le projet MUST aller au bac de son équipe, et l'aperçu MUST l'annoncer avant l'import. Si la cible finit après la fenêtre, la fenêtre MUST être agrandie juste assez.

#### Scenario: Ligne suivante
- **GIVEN** un vase dont la première ligne est occupée du 16 novembre au 28 décembre
- **WHEN** l'import pose un projet du 30 novembre au 11 janvier
- **THEN** le projet commence le 30 novembre, sur la deuxième ligne

#### Scenario: Plus de place
- **GIVEN** un vase de 2 personnes dont les deux lignes sont occupées en décembre
- **WHEN** l'import doit poser un projet planifié en décembre
- **THEN** l'aperçu annonce qu'il ira au bac de l'équipe, et après l'import il y attend, sans dates

#### Scenario: Au-delà de la fenêtre
- **GIVEN** une fenêtre de 52 semaines et une cible qui finit 2 semaines après son bord droit
- **WHEN** l'utilisateur applique l'import
- **THEN** la fenêtre passe à 54 semaines et le projet est posé à sa date

### Requirement: Équipes de l'export

Les équipes du JSON MUST être rapprochées des équipes existantes par leur nom, à la casse et aux espaces près. Une équipe absente MUST être créée avec l'effectif saisi dans l'aperçu, avant la pose de ses projets. L'effectif d'une équipe existante MUST NOT changer.

#### Scenario: Équipe à créer
- **GIVEN** un export contenant l'équipe Aurora, absente de Cailloux
- **WHEN** l'utilisateur saisit 3 personnes pour Aurora et applique l'import
- **THEN** le vase Aurora existe avec 3 personnes, et ses projets y sont posés

#### Scenario: Équipe existante
- **GIVEN** l'équipe « Artémis » de 5 personnes dans Cailloux, et « artémis » dans le JSON
- **THEN** l'aperçu la rattache à l'équipe existante, sans demander d'effectif

### Requirement: Projets absents de l'export

Un projet de Cailloux qui appartient à une équipe présente dans le JSON, mais qui n'est pas dans le fichier, MUST être signalé dans l'aperçu. L'import MUST NOT le modifier.

#### Scenario: Signalé, pas touché
- **GIVEN** un projet posé dans Artémis, absent du JSON qui contient Artémis
- **WHEN** l'utilisateur applique l'import
- **THEN** l'aperçu l'a signalé comme absent de l'export, et le projet n'a pas changé

### Requirement: Appliquer la comparaison

Valider l'aperçu de comparaison MUST appliquer toutes les actions retenues en une fois. Un seul Ctrl+Z MUST tout annuler, créations d'équipes et agrandissement de la fenêtre compris. Un message MUST résumer ce qui a été fait. Fermer l'aperçu sans valider MUST NOT modifier le planning.

#### Scenario: Annuler l'import
- **GIVEN** un import qui vient de créer l'équipe Aurora et de poser 31 projets
- **WHEN** l'utilisateur annule (Ctrl+Z) une seule fois
- **THEN** Aurora n'existe plus et les 31 projets ont retrouvé leur état d'avant

### Requirement: Métadonnées de la planification

Un projet créé, posé ou aligné par l'import JSON MUST recevoir en métadonnées les informations du JSON (code, référence externe, statut, chef de projet, chiffres, semaines planifiées à venir, commentaires), ajoutées à ses métadonnées existantes ; une valeur du JSON MUST remplacer celle de même nom.

#### Scenario: Métadonnées complétées
- **GIVEN** « Offre crypto » importé depuis l'Excel avec ses métadonnées, puis posé par l'import JSON
- **THEN** il garde ses métadonnées Excel et reçoit en plus ses chiffres et ses semaines planifiées
