# Proposition

## Pourquoi

L'import Excel a fait entrer le portefeuille dans le bac commun, mais sans charges, sans équipes et sans dates. Ces informations existent dans l'outil de planification, qui les exporte en JSON (équipes, projets, charges semaine par semaine). Les reporter à la main projet par projet serait long, et à refaire à chaque nouvel export. Cailloux doit pouvoir lire cet export, le **comparer** à ce qu'il contient déjà, et proposer pour chaque projet l'action qui le met en place comme on l'aurait fait à la main.

## Ce qui change

- Le bouton « Importer… » et le dépôt sur le dock acceptent aussi un **export JSON de planification**. Un fichier `.json` ouvre un aperçu de comparaison, distinct de l'aperçu de l'import Excel.
- Pour chaque projet du JSON, le système calcule une **cible** : son équipe, et une brique d'**une personne** qui va de sa **première semaine planifiée à venir** (la semaine en cours comprise) à sa **dernière semaine planifiée**, avec pour charge le **total des jours planifiés à venir**. Les semaines passées sont ignorées. Une brique dont les semaines sont éparses garde toute sa durée : la part non chargée apparaît comme de l'air.
- La cible est rapprochée des projets existants par le nom (même règle que l'import Excel). Chaque projet reçoit un état et une action par défaut :
  - **Nouveau** (absent de Cailloux) : créé et posé à sa date ;
  - **À poser** (dans le bac commun ou un bac d'équipe) : prend la forme cible et est posé à sa date ;
  - **À jour** (posé, conforme à la cible) : aucune action ;
  - **Écart** (posé, mais équipe, début, durée ou charge différents, ou dans le bac d'une autre équipe) : **laissé tel quel** par défaut, avec l'option « aligner sur le JSON » ;
  - **Non planifié** (aucune semaine dans le JSON) : envoyé par défaut au **bac de son équipe** s'il est dans le bac commun ou absent de Cailloux, sinon laissé ;
  - **Sans suite** (toutes ses semaines sont passées) : seulement signalé ;
  - **Absent du JSON** (dans Cailloux, dans une équipe présente dans le JSON, mais pas dans le fichier) : seulement signalé.
- **Pose comme à la main** : une brique est posée à sa semaine exacte, sur la ligne libre la plus basse sur toute sa durée. Les dates ne sont jamais décalées. Sans ligne libre, le projet va au bac de son équipe, et l'aperçu l'annonce avant l'import. Si un projet finit après la fenêtre, la fenêtre est agrandie juste assez.
- Les **équipes** du JSON sont rapprochées des équipes existantes par leur nom. Celles qui manquent sont créées, avec un **effectif saisi** dans l'aperçu, car le JSON ne le donne pas.
- Les **métadonnées** du projet sont complétées par celles du JSON (code, référence externe, statut, chef de projet, chiffres, répartition des semaines planifiées, commentaires).
- Tout s'applique en une fois : **un seul Ctrl+Z** annule l'import entier.
- **Air** : la définition s'élargit. L'air n'est plus seulement dû à l'arrondi aux cases entières ; c'est aussi la charge diluée dans le temps d'un projet importé.

## Hors périmètre

- Plusieurs rôles ou ressources sur un même projet : on considère un seul rôle, donc une seule personne de hauteur.
- Associer une équipe du JSON à une équipe de Cailloux de nom différent.
- Importer la partie passée d'un projet.
- Supprimer ou retirer un projet absent du JSON : il est seulement signalé.
- Les jalons (vides dans les exports actuels).

## Capacités

### Nouvelles capacités

Aucune.

### Capacités modifiées

- `import-projets` : l'import accepte un export JSON de planification, comparé aux projets existants, avec des états, des actions par défaut, la pose à date exacte, la création d'équipes et l'enrichissement des métadonnées. Les exigences de l'import Excel ne changent pas.

## Impact

- **Domaine** (`src/app/domain`) : lecture et validation de l'export JSON, calcul des cibles (partie à venir), comparaison avec l'état, règle de pose à date exacte, plan d'actions ; avec leurs tests.
- **État** (`src/app/state`) : application du plan en un seul `commit()` (création d'équipes, de projets, poses, alignements, agrandissement de la fenêtre) ; `ViewService` pour ouvrir l'aperçu.
- **Interface** (`src/app/ui`) : le dock accepte `.json` ; nouveau dialogue de comparaison, regroupé par équipe.
- **Documentation** : `GLOSSARY.md` (air), `CLAUDE.md`, README.
- **Dépendances** : aucune nouvelle.
