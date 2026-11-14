# Un bac commun à côté des bacs d'équipe

Pour garder les projets qu'aucune équipe n'a encore pris, on ajoute un bac d'attente partagé par toutes les équipes, sans retirer le bac de chaque vase : un projet peut désormais n'appartenir à aucune équipe. Le choix « en commun ou propre à l'équipe » se fait projet par projet, parce que « pas encore arbitré » et « promis à une équipe, pas encore daté » sont deux situations différentes.

## Options écartées

- **Un interrupteur global** « bacs par équipe / bac commun » : il ne changeait que l'affichage et laissait sans réponse l'équipe d'une brique déposée dans le bac en mode commun.
- **Un bac commun unique**, sans bacs d'équipe : on perdait l'attribution des projets promis à une équipe mais pas encore datés.

## Conséquences

- Supprimer une équipe envoie ses projets, posés ou non, au bac commun au lieu de les supprimer : ils perdent leurs dates mais pas leur saisie (dans l'esprit de l'ADR 0002).
- Un projet sans équipe n'est borné par aucun effectif : en entrant dans un vase, il est ramené à l'effectif en gardant sa charge, comme à la création.
- Les sauvegardes existantes restent valides (tous leurs projets ont une équipe) : pas de changement de clé de stockage.
