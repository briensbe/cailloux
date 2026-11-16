# import-projets Specification

## Purpose

Faire entrer dans l'application une liste de projets venue d'un autre outil, sans la ressaisir : les projets arrivent dans le bac commun, identifiés par leur nom, avec les informations d'origine gardées comme métadonnées.

## ADDED Requirements

### Requirement: Ouvrir un fichier à importer

En mode Vases, l'utilisateur MUST pouvoir importer un fichier `.xlsx` de deux façons : en le déposant sur le dock du bac commun, ou avec un bouton « Importer… » du dock. Le dock MUST s'éclairer pendant qu'un fichier le survole. En mode Étagère, l'import MUST NOT être proposé.

#### Scenario: Dépôt sur le dock
- **GIVEN** le mode Vases
- **WHEN** l'utilisateur glisse un fichier `.xlsx` depuis son explorateur de fichiers et le lâche sur le dock
- **THEN** l'aperçu d'import s'ouvre avec les lignes du fichier

#### Scenario: Bouton Importer
- **WHEN** l'utilisateur clique sur « Importer… » dans le dock et choisit un fichier `.xlsx`
- **THEN** l'aperçu d'import s'ouvre avec les lignes du fichier

#### Scenario: Étagère en lecture seule
- **GIVEN** le mode Étagère
- **WHEN** l'utilisateur lâche un fichier sur le dock
- **THEN** rien n'est importé et aucun aperçu ne s'ouvre

### Requirement: Fichier illisible

Si le fichier n'est pas un `.xlsx` lisible, ou si sa première feuille n'a pas de colonne de nom, le système MUST l'indiquer par un message et MUST NOT modifier le planning.

#### Scenario: Mauvais format
- **WHEN** l'utilisateur dépose un fichier PDF sur le dock
- **THEN** un message indique que le fichier n'a pas pu être lu, et le planning est inchangé

#### Scenario: Pas de colonne de nom
- **GIVEN** un fichier `.xlsx` dont la première ligne ne contient ni « Nom Projet » ni « Nom »
- **WHEN** l'utilisateur l'importe
- **THEN** un message indique qu'aucune colonne de nom n'a été trouvée, et le planning est inchangé

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
