# import-projets Specification

## Purpose

Faire entrer dans l'application une liste de projets venue d'un autre outil, sans la ressaisir : les projets arrivent dans le bac commun, identifiés par leur nom, avec les informations d'origine gardées comme métadonnées.

## Requirements

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

### Requirement: Colonnes du fichier

La première ligne de la première feuille MUST être lue comme une ligne d'en-têtes, et chaque ligne suivante comme un projet. Les colonnes MUST être reconnues par leur nom, sans tenir compte de leur ordre, de la casse, des accents ni des espaces : « Nom Projet » (ou « Nom ») donne le nom du projet, toutes les colonnes reconnues ou non deviennent des métadonnées.

#### Scenario: Colonnes dans un autre ordre
- **GIVEN** un fichier dont les colonnes sont, dans l'ordre, « Statut », « nom projet », « Code Projet »
- **WHEN** l'utilisateur l'importe
- **THEN** l'aperçu prend les noms de projet dans la deuxième colonne

#### Scenario: Ligne vide
- **GIVEN** une ligne du fichier dont le nom est vide ou ne contient que des espaces
- **THEN** l'aperçu la montre comme ignorée, et elle ne peut pas être importée

### Requirement: Identité des projets par le nom

Deux projets MUST être considérés comme le même projet quand leurs noms ne diffèrent que par la casse ou par des espaces (au début, à la fin, ou plusieurs à la suite). Le nom importé MUST être débarrassé de ses espaces de début et de fin ; le reste du nom MUST être gardé tel quel.

#### Scenario: Espaces et casse
- **GIVEN** un projet « BCEF - Etude change » dans le planning
- **WHEN** le fichier contient la ligne «  bcef -  Etude change »
- **THEN** l'aperçu la marque comme déjà présente

#### Scenario: Nom nettoyé
- **WHEN** l'utilisateur importe une ligne nommée « Offre crypto  » (avec des espaces à la fin)
- **THEN** le projet créé s'appelle « Offre crypto »

### Requirement: Projet déjà présent

Une ligne dont le nom désigne un projet déjà présent dans le planning, quelle que soit son équipe et qu'il soit posé ou en attente, MUST être marquée « déjà présent » et décochée. Elle MUST NOT pouvoir être importée tant que son nom n'est pas changé. Le projet existant MUST NOT être modifié.

#### Scenario: Ré-import du même fichier
- **GIVEN** un fichier de 20 projets déjà importé, dont 5 ont depuis été posés dans des vases
- **WHEN** l'utilisateur importe à nouveau le même fichier
- **THEN** les 20 lignes sont marquées « déjà présent », et les 5 projets posés gardent leur équipe, leurs dates et leur charge

### Requirement: Nom en double dans le fichier

Quand plusieurs lignes du fichier désignent le même projet, la première MUST être proposée normalement et les suivantes MUST être marquées « doublon dans le fichier » et décochées. Une ligne en doublon que l'utilisateur renomme d'un nom libre MUST redevenir importable.

#### Scenario: Deux lignes, un seul projet
- **GIVEN** un fichier où « Trajectoire mobile vers RSW » apparaît sur deux lignes
- **THEN** l'aperçu propose la première ligne et marque la seconde « doublon dans le fichier »

#### Scenario: Garder les deux en renommant
- **GIVEN** la seconde ligne « Trajectoire mobile vers RSW » marquée en doublon
- **WHEN** l'utilisateur la renomme « Trajectoire mobile vers RSW (2024_001) » dans l'aperçu
- **THEN** elle devient importable, et l'import crée les deux projets

### Requirement: Aperçu avant import

Avant toute écriture, le système MUST montrer chaque ligne avec son nom, sa pierre, sa charge et son état (nouveau, déjà présent, doublon dans le fichier, ignoré). L'utilisateur MUST pouvoir cocher ou décocher les lignes importables, renommer une ligne, et annuler sans que le planning change.

#### Scenario: Annuler l'aperçu
- **GIVEN** l'aperçu d'un fichier de 125 lignes
- **WHEN** l'utilisateur ferme l'aperçu sans valider
- **THEN** le planning et l'historique d'annulation sont inchangés

#### Scenario: Décocher une ligne
- **GIVEN** l'aperçu avec 3 lignes nouvelles
- **WHEN** l'utilisateur en décoche une et valide
- **THEN** seuls les 2 autres projets sont créés

### Requirement: Filtre par statut

Si le fichier contient une colonne « Statut », l'aperçu MUST proposer de filtrer les lignes par valeur de statut, toutes les valeurs étant retenues au départ. Écarter un statut MUST décocher ses lignes ; le retenir de nouveau MUST recocher celles qui sont importables.

#### Scenario: Écarter les projets en pause
- **GIVEN** un fichier dont 6 lignes ont le statut « En pause »
- **WHEN** l'utilisateur écarte le statut « En pause »
- **THEN** ces 6 lignes sont décochées, et le total de l'aperçu diminue d'autant

### Requirement: Charge des projets importés

Chaque ligne MUST recevoir une charge, car le fichier n'en fournit pas. L'aperçu MUST proposer une charge par défaut de 5 j/h, modifiable, qui s'applique à toutes les lignes dont la charge n'a pas été saisie à part ; l'utilisateur MUST pouvoir saisir la charge d'une ligne. Un projet importé MUST être en charge libre et MUST occuper une seule personne.

#### Scenario: Charge par défaut
- **WHEN** l'utilisateur importe 10 lignes sans toucher aux charges
- **THEN** les 10 projets ont 5 j/h, sur 1 personne × 1 semaine

#### Scenario: Charge saisie sur une ligne
- **GIVEN** la charge par défaut passée à 10 j/h, et 40 j/h saisis sur la ligne « Offre crypto »
- **WHEN** l'utilisateur valide
- **THEN** « Offre crypto » a 40 j/h et les autres projets 10 j/h

### Requirement: Bilan de l'aperçu

Le pied de l'aperçu MUST indiquer le nombre de projets cochés, leur charge totale, et si cette charge, ajoutée à celle du bac commun, tiendrait dans la capacité restante de toutes les équipes sur la période sélectionnée.

#### Scenario: Ne tiendrait pas
- **GIVEN** un bac commun vide et une capacité restante de 400 j/h sur la période
- **WHEN** l'aperçu compte 112 projets cochés à 5 j/h
- **THEN** le pied indique 112 projets, 560 j/h, « ne tiendrait pas »

### Requirement: Pierre d'après la couleur d'origine

Si le fichier contient une colonne « Couleur » avec une couleur hexadécimale valide, le projet MUST prendre la pierre dont la teinte est la plus proche. Sinon, il MUST prendre la pierre que le bac commun attribue à un nouveau projet.

#### Scenario: Vert vers jade
- **GIVEN** une ligne de couleur `#22c55e`
- **THEN** l'aperçu lui donne la pierre Jade

#### Scenario: Couleur absente
- **GIVEN** une ligne sans couleur
- **THEN** l'aperçu lui donne la pierre suivante du bac commun

### Requirement: Créer les projets dans le bac commun

Valider l'aperçu MUST créer en une fois les projets cochés dans le bac commun, sans équipe ni dates. Un seul Ctrl+Z MUST annuler tout l'import. Un message MUST indiquer le nombre de projets importés et proposer d'annuler. Si aucune ligne n'est cochée, la validation MUST NOT être possible.

#### Scenario: Import de 112 projets
- **GIVEN** l'aperçu avec 112 lignes cochées
- **WHEN** l'utilisateur valide
- **THEN** 112 projets apparaissent dans le bac commun, triés par charge, et un message « 112 projets importés dans le bac commun » propose d'annuler

#### Scenario: Annuler l'import
- **GIVEN** un import qui vient de créer 112 projets
- **WHEN** l'utilisateur annule (Ctrl+Z) une seule fois
- **THEN** les 112 projets disparaissent et le bac commun retrouve son contenu d'avant

### Requirement: Métadonnées conservées

Chaque projet importé MUST garder comme métadonnées les valeurs non vides de toutes les colonnes de sa ligne autres que le nom, chacune sous le nom de sa colonne tel qu'il apparaît dans le fichier. Les métadonnées MUST survivre aux déplacements, aux changements de forme, à l'annulation et au rechargement de la page.

#### Scenario: Métadonnées d'une ligne
- **GIVEN** une ligne « Offre crypto » avec Code Projet `2026_002`, Statut « En cours », Référence Externe `SUIVI-2177` et une description vide
- **WHEN** elle est importée
- **THEN** le projet a pour métadonnées Code Projet, Statut et Référence Externe, sans Description

#### Scenario: Après un rechargement
- **GIVEN** un projet importé posé ensuite dans un vase
- **WHEN** l'utilisateur recharge la page
- **THEN** le projet a toujours ses métadonnées

### Requirement: Afficher les métadonnées

Quand le projet sélectionné a des métadonnées, l'inspecteur MUST les afficher en lecture seule, chaque valeur avec le nom de sa colonne. Un projet sans métadonnées MUST NOT afficher de section vide.

#### Scenario: Projet importé
- **WHEN** l'utilisateur sélectionne un projet importé
- **THEN** l'inspecteur montre ses métadonnées, par exemple « Chef de Projet : Robin Glass »

#### Scenario: Projet créé à la main
- **WHEN** l'utilisateur sélectionne un projet créé avec « + Caillou »
- **THEN** l'inspecteur ne montre pas de section de métadonnées

### Requirement: Compatibilité des sauvegardes avec les métadonnées

Un planning sauvegardé avant cette évolution MUST se recharger tel quel, sans perte ; ses projets n'ont simplement pas de métadonnées.

#### Scenario: Ancienne sauvegarde
- **GIVEN** un planning sauvegardé avant l'import de fichiers
- **WHEN** l'utilisateur rouvre l'application
- **THEN** il retrouve ses équipes, ses projets et sa fenêtre, sans métadonnées

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
