# Design

## Context

Voir `proposal.md` pour la motivation, les specs `bac-commun` et `etagere` pour le comportement attendu, et les deltas `debordement` et `capacite-par-periode` pour ce qui change dans l'existant. La décision de fond (un projet peut n'avoir aucune équipe) est dans l'ADR 0003.

État actuel du code :

- `Project.teamId` est une `string` obligatoire ; `start = row = null` signifie « dans le bac de l'équipe ». Chaque `Reservoir` filtre `store.projectsOf(teamId)` et affiche son bac sous le vase (`data-drop-kind="tray"`, `data-drop-team`).
- `DragService.targetAt` cherche l'élément `[data-drop-team]` sous le curseur ; sans place trouvée par `findNearestFree` (brique trop haute pour le vase), il n'y a pas de cible et la brique revient à son point de départ.
- `addProject` borne les personnes à l'effectif avec `initialDims(charge, min(persons, size))` ; `moveToTeam` et le dépôt ne recalent rien.
- `removeTeam` supprime l'équipe et ses projets.
- `ViewService` retient zoom, « tout voir » et période dans `cailloux.view.v1`, en fusionnant le contenu stocké avec des valeurs par défaut (`{ ...fallback, ...stored }`) : de nouveaux champs n'exigent pas de nouvelle clé. `newProjectFor: string | null` sert à la fois d'équipe cible et d'indicateur « dialogue ouvert ».
- Le tableau empile les vases (`.board`, flex en colonne) ; chaque vase a son propre défilement horizontal (`.scroller`). La barre d'outils est collante en haut.
- La maquette de la branche `prototype/etagere` (variante A et bande globale de B) sert de référence visuelle ; son code n'est pas repris tel quel.

## Goals / Non-Goals

**Goals :**

- Introduire le projet sans équipe avec le moins de nouvelles notions possible : `teamId: null` suffit, sans nouveau champ ni nouvel état.
- Une seule règle d'entrée dans un vase, en domaine et testée, utilisée à la fois par le dépôt, l'aperçu du glisser et l'inspecteur.
- Une Étagère qui ne dépend ni du `DragService` ni des composants interactifs : elle ne fait que lire le store.

**Non-Goals :**

- Ordre manuel ou priorité dans les bacs.
- Glisser ou éditer depuis l'Étagère, et navigation de l'Étagère vers le mode Vases.
- Aligner les vases du mode Vases sur un défilement commun : le mode Vases ne change pas.
- Effectif daté (vase à hauteur variable).

## Decisions

### 1. `teamId: string | null`, sans changement de clé de stockage

Un projet du bac commun a `teamId = null` et, toujours, `start = row = null`. Une sauvegarde `cailloux.state.v2` existante n'a que des `teamId` renseignés : c'est déjà un état valide du nouveau format, donc la clé ne change pas et aucune migration n'est nécessaire. `loadState` n'a rien à changer (sa validation reste superficielle).

_Alternatives écartées_ : un tableau `common: Project[]` à part dans `PlanningState`, qui dupliquerait toutes les opérations sur les projets (déplacer, supprimer, mettre à jour) ; un champ `shared: boolean` à côté d'un `teamId` conservé, qui laisserait vivre une équipe « fantôme » sans signification métier (Q2 de la conception).

### 2. La règle d'entrée dans un vase vit dans le domaine

Nouvelle fonction pure dans `domain/capacity.ts`, par exemple `fitToTeam(project, teamSize): Dims` : si `persons <= teamSize`, la forme ne change pas ; sinon `initialDims(charge, teamSize)`. On passe par `initialDims` et non par `withPersons`, parce qu'en mode `free` `withPersons` fait suivre la charge à la surface, donc la ferait baisser ; la spec exige de garder la charge quel que soit le mode.

Utilisations :

- `PlanningStore.moveProject` applique `fitToTeam` dès que la brique entre dans un vase (cellule non nulle) ou change d'équipe ; `moveToTeam` l'applique avant `findFirstFit`.
- `DragService.targetAt` calcule la forme recalée pour l'équipe survolée avant d'appeler `findNearestFree`, et l'expose dans la cible (`{ kind: 'grid', teamId, cell, dims }`), pour que le fantôme du `Reservoir` dessine la forme recalée et que le dépôt pose exactement ce qui a été montré.

Le recalage n'est pas une « reformation automatique » au sens de l'ADR 0002 : il n'a lieu que sur un geste de l'utilisateur, jamais sur une baisse d'effectif.

### 3. Une troisième sorte de cible de dépôt : le dock

`DropTarget` gagne `{ kind: 'common' }`. Le dock porte `data-drop-kind="common"` sans `data-drop-team` ; `targetAt` cherche donc `[data-drop-team], [data-drop-kind="common"]`. Le dépôt appelle `store.moveProject(id, null, null)`. Le dock n'est une cible qu'en mode Vases.

Le bac d'équipe garde sa cible actuelle (`kind: 'tray'`, `teamId`) : y déposer un projet du bac commun lui attribue l'équipe sans le dater.

### 4. Création dans le bac commun

`ViewService.newProjectFor` devient `signal<{ teamId: string | null } | null>` : `null` = dialogue fermé, `{ teamId: null }` = création dans le bac commun. `ProjectDialog` borne alors les personnes à 30 (`MAX_TEAM_SIZE`, aujourd'hui en dur dans `setTeamSize`, à extraire en constante) et masque le placement et l'agrandissement de fenêtre. `PlanningStore.addProject(teamId: string | null, …)` court-circuite la recherche de place quand `teamId` est `null`, sans toast. La couleur suit `nextColor` calculé sur les projets du bac commun.

_Alternative écartée_ : une valeur sentinelle `'common'` dans un `string | null`, qui ressemblerait à un identifiant d'équipe.

### 5. Supprimer une équipe

`removeTeam` remplace, dans un seul `commit()`, l'équipe supprimée et ses projets par les mêmes projets avec `teamId = start = row = null`. L'annulation restaure l'état précédent entier, donc dates et positions comprises. Le toast indique le nombre de projets passés au bac commun.

### 6. Indicateurs : deux fonctions de domaine

- `period.ts` : la charge du bac commun et son « tiendrait » face à la somme des capacités restantes, calculés à partir de `sumFigures` des équipes. `periodFigures` reste par équipe et n'a pas à connaître le bac commun, puisque `projectsOf(teamId)` ne renvoie jamais un projet sans équipe.
- Personnes libres par semaine, toutes équipes : somme des `Occupancy.freePerWeek()` de chaque vase sur la fenêtre, dans une fonction de domaine testée (par exemple dans `window.ts`). Les lignes en débordement ne créent pas de personnes libres négatives : `freePerWeek` ne compte que les lignes de l'effectif.

Le total « en attente » de l'en-tête (`App.totals`) ajoute la charge du bac commun à celle des bacs d'équipe et expose la part non attribuée.

### 7. L'Étagère : un composant à part, en lecture seule

Nouveau dossier `ui/etagere/` avec un composant `Etagere` et un sous-composant de vase miniature (16 px par personne, assez pour lire le nom d'un projet d'une seule personne, constante à part de `CELL_H`). Il dessine des briques simples (pas le composant `Brick`, qui porte poignées et glisser) et n'injecte ni `DragService` ni actions du store. La mise en page suit la variante A de la maquette : une grille à deux colonnes (en-têtes, vases), la bande des personnes libres en première ligne, puis la règle du temps collante, puis une ligne par équipe.

Le mode et le zoom vivent dans `ViewService` et sont retenus dans `cailloux.view.v1` : `mode: 'vases' | 'etagere'`, `shelfZoom`, `shelfFit` (vrai par défaut) et `dockOpen`. `cellW` reste celui du mode Vases ; l'Étagère a son propre `shelfCellW` calculé de la même façon, avec la largeur de sa colonne d'en-têtes à la place de `VASE_CHROME_PX`. Le curseur de zoom et « Tout voir » de la barre d'outils pilotent le zoom du mode affiché.

Lecture seule de l'Étagère, au-delà des briques :

- passer sur l'Étagère désélectionne la brique, ce qui ferme l'inspecteur et neutralise les flèches et Suppr de `App.onKey` (ils n'agissent que sur une brique sélectionnée) ;
- `App.onKey` ignore aussi Ctrl+Z et Ctrl+Y sur l'Étagère, et la barre d'outils y masque Annuler, Rétablir, « Nouvelle équipe » et « Recharger la démo » : une annulation déplacerait des briques sous les yeux de l'utilisateur, ce que la spec exclut. Le décalage et la longueur de la fenêtre, la période et le zoom restent disponibles, car ils changent ce qu'on regarde et pas les projets.

### 8. Le dock

Composant `ui/dock/`, rendu par `App` dans les deux modes, en `position: fixed` en bas de l'écran. Il réserve sa hauteur en bas de page pour ne pas masquer le dernier vase. Les mini-briques réutilisent le composant `Brick` en version `mini`, comme le bac d'équipe, et le même `DragService.press`. Sur l'Étagère, le `pointerdown` n'est pas branché et « + Caillou » est inactif.

Le tri par charge décroissante se fait dans les `computed` qui alimentent le dock et le bac d'équipe du `Reservoir`.

## Risks / Trade-offs

- [La règle collante de l'Étagère ne colle plus quand un conteneur défile horizontalement : `overflow-x: auto` en fait la référence du `sticky`] → En « Tout voir » (par défaut), il n'y a pas de défilement horizontal. Au-delà, faire défiler la règle et les vases dans deux conteneurs synchronisés par `scrollLeft` ; à vérifier dans le navigateur en zoom maximal.
- [Recaler une brique pendant le glisser change sa forme sous le curseur, et le point de saisie peut tomber hors de la nouvelle forme] → Le fantôme montre la forme recalée ; la brique déplacée garde son apparence d'origine jusqu'au dépôt, puis l'animation FLIP part de la forme d'origine. À juger dans le navigateur.
- [Les nombreux appels `projectsOf(teamId)` ne voient pas le bac commun, et un appel oublié avec `null` renverrait le bac commun comme s'il était une équipe] → Typer `projectsOf(teamId: string)` ; un `computed` `commonProjects` dédié pour le bac commun.
- [Le dock fixe réduit la hauteur utile sur un petit écran] → Il se replie en une barre ; son état est retenu.
- [Supprimer une équipe remplit vite le bac commun] → Le toast propose d'annuler ; le tri par charge garde les gros projets en tête.

## Migration Plan

Aucune migration de données : les sauvegardes `cailloux.state.v2` et `cailloux.view.v1` existantes restent lisibles telles quelles (décision 1 et fusion avec les valeurs par défaut dans `readView`). Retour arrière : un planning qui contient des projets sans équipe, relu par une version précédente, ferait disparaître ces projets de l'affichage sans les supprimer du stockage.
