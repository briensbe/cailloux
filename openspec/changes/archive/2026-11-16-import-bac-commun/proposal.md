# Proposition

## Pourquoi

Le portefeuille de projets existe déjà ailleurs, sous forme d'un export Excel (« Export_Projets_Filtrés », plus d'une centaine de lignes). Aujourd'hui, il faudrait recréer chaque caillou à la main avec « + Caillou ». Importer cet export dans le bac commun permet de partir de la vraie liste, puis d'arbitrer en glissant les briques vers les vases. C'est aussi la première étape d'un import en deux temps : les exports JSON de planification, qui portent les charges et les semaines, viendront compléter ces projets par la suite.

## Ce qui change

- On peut **importer un fichier `.xlsx`** dans le bac commun, en le déposant sur le dock ou avec un bouton « Importer… » à côté de « + Caillou ». En mode Étagère (lecture seule), l'import n'est pas proposé.
- Un **aperçu** s'ouvre avant toute écriture. Il liste les lignes du fichier avec leur nom, la pierre choisie, la charge, et un état : nouveau, déjà présent, doublon dans le fichier, ou ignoré (sans nom). On peut décocher des lignes, filtrer par statut, fixer une charge par défaut ou une charge ligne par ligne, et renommer une ligne. Le pied de l'aperçu indique le total importé et s'il tiendrait dans la capacité restante de toutes les équipes.
- **Le nom identifie un projet.** Deux noms sont considérés comme identiques s'ils ne diffèrent que par la casse ou par des espaces (en trop, au début ou à la fin). Un projet dont le nom existe déjà n'est pas importé, et le projet existant n'est pas modifié. Si un nom apparaît plusieurs fois dans le fichier, seule la première ligne est proposée.
- **Les autres colonnes sont gardées comme métadonnées** du projet (code, statut, description, référence externe, chef de projet, couleur d'origine, et toute autre colonne présente). L'application ne les interprète pas, à une exception près : la couleur d'origine choisit la pierre la plus proche. L'inspecteur les affiche en lecture seule.
- L'export Excel n'a pas de charge. Chaque projet reçoit donc la charge par défaut de l'aperçu (5 j/h, soit une case), modifiable avant l'import.
- La validation crée tous les projets d'un coup dans le bac commun, sans équipe ni dates. Un seul Ctrl+Z annule tout l'import, et un message indique combien de projets ont été importés.
- Les sauvegardes existantes restent valides : les métadonnées sont facultatives et la clé de stockage ne change pas.

## Hors périmètre

- L'import des exports JSON de planification (charges, équipes, semaines). Cette proposition prépare seulement la règle d'identité par le nom, que cet import réutilisera.
- La mise à jour de projets existants par un nouvel import.
- L'unicité des noms lors d'une création ou d'un renommage à la main : elle n'est contrôlée qu'à l'import.
- Les formats CSV et `.xls` (ancien format binaire d'Excel).

## Capacités

### Nouvelles capacités

- `import-projets` : importer une liste de projets depuis un fichier dans le bac commun, avec l'identité des projets par leur nom, l'aperçu avant import, les métadonnées conservées et leur affichage. Cette capacité accueillera plus tard l'import des JSON de planification.

### Capacités modifiées

Aucune : le bac commun reçoit les projets importés selon ses règles actuelles (sans équipe, sans dates, triés par charge).

## Impact

- **Domaine** (`src/app/domain`) : champ facultatif `meta` sur `Project` ; nouveau module d'import (repérage des colonnes, clé de nom, doublons, choix de la pierre la plus proche, plan d'import) avec ses tests.
- **Lecture de fichier** : un lecteur `.xlsx` sans dépendance, à partir des API natives du navigateur (décompression et analyse XML).
- **État** (`src/app/state`) : `PlanningStore.importProjects` (un seul `commit`, message avec « Annuler ») ; `ViewService` pour ouvrir l'aperçu.
- **Interface** (`src/app/ui`) : dépôt de fichier et bouton « Importer… » dans le dock, nouveau dialogue d'aperçu, section « Métadonnées » dans l'inspecteur.
- **Documentation** : `CLAUDE.md` (champ `meta`, règle d'identité par le nom), glossaire (métadonnées), README.
- **Dépendances** : aucune nouvelle.
