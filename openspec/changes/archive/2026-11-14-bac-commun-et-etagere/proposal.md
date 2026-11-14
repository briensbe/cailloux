# Proposition

## Pourquoi

Aujourd'hui, un projet appartient toujours à une équipe, même quand il attend sans dates : on ne peut pas garder un projet « pas encore arbitré » sans le promettre d'avance à un vase. Et chaque vase a son propre axe du temps et son propre défilement : il est difficile de comparer d'un coup d'œil la charge des équipes, ou de voir où il reste de la place, toutes équipes confondues.

## Ce qui change

- Un **bac commun**, partagé par toutes les équipes, s'ajoute au bac de chaque équipe. Il contient les projets qu'aucune équipe n'a encore pris. Le choix entre bac commun et bac d'équipe se fait projet par projet (cf. ADR 0003).
- Le bac commun s'affiche dans un **dock** fixé en bas de l'écran, repliable, visible quel que soit le défilement. En mode Vases, on y glisse les briques vers un vase, ou depuis un vase ou un bac d'équipe pour les remettre en commun.
- On crée un projet directement dans le bac commun avec « + Caillou » dans le dock. L'inspecteur propose « Aucune (bac commun) » dans la liste des équipes.
- Les bacs d'attente sont triés par charge décroissante, sans priorité manuelle : ce n'est pas un backlog.
- **BREAKING** Un projet qui entre dans un vase trop étroit pour lui (glisser depuis n'importe où, changement d'équipe dans l'inspecteur) est ramené à l'effectif en gardant sa charge : moins de personnes, plus de semaines. Jusqu'ici, un tel dépôt était refusé.
- Le dock affiche la charge totale du bac commun et indique si elle tiendrait dans la capacité restante de toutes les équipes sur la période. La charge en attente de l'en-tête compte les deux sortes de bac et précise la part non attribuée.
- **BREAKING** Supprimer une équipe envoie ses projets, posés ou non, au bac commun, sans leurs dates, au lieu de les supprimer.
- Un second mode d'affichage, l'**Étagère**, s'ajoute au mode Vases, avec un sélecteur dans la barre d'outils. L'Étagère montre tous les vases en miniature (hauteur proportionnelle à l'effectif) sous une seule règle du temps, une colonne d'en-têtes avec les indicateurs de période de chaque équipe, et au-dessus de la règle une bande des personnes libres chaque semaine, toutes équipes confondues. Elle est en pure lecture seule, dock compris.
- Les sauvegardes existantes restent valides : la clé de stockage ne change pas.

## Capacités

### Nouvelles capacités

- `bac-commun` : le bac d'attente partagé par toutes les équipes, les projets sans équipe, le dock, la création et le passage d'un bac à l'autre, l'entrée d'un projet dans un vase trop étroit, le tri des bacs, le sort des projets d'une équipe supprimée.
- `etagere` : le mode de comparaison en lecture seule de toutes les équipes (vases miniatures, règle du temps commune, en-têtes et indicateurs, bande des personnes libres, signalements, zoom propre).

### Capacités modifiées

- `debordement` : le dépôt d'une brique trop haute pour le vase la ramène à l'effectif au lieu d'être refusé ; le bac d'attente reçoit aussi les projets d'une équipe supprimée (bac commun).
- `capacite-par-periode` : la charge en attente existe aussi pour le bac commun, comparée à la capacité restante de toutes les équipes ; le total de l'en-tête compte les deux sortes de bac.

## Impact

- **Domaine** (`src/app/domain`) : `Project.teamId` peut valoir `null` ; règle d'entrée dans un vase (ramener les personnes à l'effectif en gardant la charge) ; indicateurs du bac commun ; personnes libres par semaine, toutes équipes. Nouveaux tests.
- **État** (`src/app/state`) : `PlanningStore` (projets sans équipe, création dans le bac commun, suppression d'équipe, dépôt recalé), `DragService` (cible « bac commun », fantôme recalé), `ViewService` (mode Vases / Étagère, zoom de l'Étagère, dock replié ou non).
- **Interface** (`src/app/ui`, `app.html`) : dock du bac commun, sélecteur de mode, composant Étagère, inspecteur (option « Aucune »), dialogue « Nouveau caillou » sans équipe, en-tête (charge non attribuée).
- **Documentation** : invariants de `CLAUDE.md` (projet sans équipe, entrée dans un vase étroit, bac commun), README. Le glossaire et l'ADR 0003 sont déjà écrits.
- La maquette de l'Étagère est sur la branche `prototype/etagere` (commit `60b0c6a`), à titre de référence visuelle seulement.
