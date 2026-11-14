# Tâches

## 1. Domaine : projets sans équipe et entrée dans un vase

- [x] 1.1 Passer `Project.teamId` à `string | null` dans `domain/model.ts` (commentaire : `null` = bac commun, toujours avec `start = row = null`) et extraire `MAX_TEAM_SIZE = 30` ; vérifier que `pnpm build` ne signale que les usages à adapter
- [x] 1.2 Ajouter `fitToTeam(project, teamSize)` dans `domain/capacity.ts` (forme inchangée si elle tient, sinon `initialDims(charge, teamSize)`), avec les tests des scénarios « Recaler à l'entrée » (120 j/h, 6 p × 4 sem. → 4 p × 6 sem.) et « Charge libre conservée » (mode `free`, 60 j/h reste 60 j/h) ; vérifier `pnpm test`

## 2. Domaine : indicateurs du bac commun et personnes libres

- [x] 2.1 Ajouter dans `domain/period.ts` le calcul de la charge du bac commun et de son « tiendrait » face à la somme des capacités restantes des équipes, avec le test du scénario « Bac commun face à toutes les équipes » (337 j/h face à 190 j/h → ne tiendrait pas) ; vérifier `pnpm test`
- [x] 2.2 Ajouter une fonction de domaine qui somme les personnes libres de chaque semaine de la fenêtre sur toutes les équipes, avec les tests « Somme des vases » (1 + 2 = 3), « Semaine saturée » (0) et une brique en débordement qui ne rend pas le décompte négatif ; vérifier `pnpm test`

## 3. État : le store et le bac commun

- [x] 3.1 `PlanningStore` : `commonProjects` (projets sans équipe), `projectsOf(teamId: string)` typé strict, `moveProject(id, teamId: string | null, cell)` qui applique `fitToTeam` à l'entrée dans un vase et efface dates et position quand `teamId` est `null`, et `moveToTeam` qui recale avant `findFirstFit` ; vérifier `pnpm build`, puis dans le navigateur qu'un projet de 5 personnes envoyé de Galets vers Silex (3 p) par l'inspecteur arrive sur 3 personnes avec la même charge
- [x] 3.2 `addProject(teamId: string | null, …)` : sans équipe, le projet va directement au bac commun, personnes bornées à `MAX_TEAM_SIZE`, sans recherche de place ni toast ; `nextColor` accepte `null` ; vérifier `pnpm build`
- [x] 3.3 `removeTeam` envoie les projets de l'équipe au bac commun (sans équipe ni dates) dans un seul `commit()`, toast « N projets de X sont passés au bac commun » avec Annuler ; vérifier dans le navigateur la suppression de Silex puis Ctrl+Z (scénarios « Suppression de Silex » et « Annuler la suppression »)
- [x] 3.4 Vérifier qu'une sauvegarde `cailloux.state.v2` créée avant ce changement se recharge sans perte et avec un bac commun vide (scénario « Ancienne sauvegarde ») : copier l'état actuel du `localStorage`, recharger, comparer
- [x] 3.5 Mettre à jour les invariants de `CLAUDE.md` : projet sans équipe (`teamId = null` ⇒ `start = row = null`), entrée dans un vase via `fitToTeam`, `projectsOf` ne renvoie jamais le bac commun, sort des projets d'une équipe supprimée ; vérifier que les noms cités existent dans le code

## 4. État : vue et glisser-déposer

- [x] 4.1 `ViewService` : `mode` (`'vases' | 'etagere'`), `shelfZoom`, `shelfFit` (vrai par défaut), `shelfCellW`, `dockOpen`, retenus dans `cailloux.view.v1` ; `newProjectFor` devient `{ teamId: string | null } | null` ; vérifier qu'un ancien `cailloux.view.v1` est relu avec les nouvelles valeurs par défaut et que le mode est retrouvé après rechargement
- [x] 4.2 `DragService` : cible `{ kind: 'common' }` (zone `data-drop-kind="common"`), et cible de grille calculée avec la forme recalée par `fitToTeam` pour l'équipe survolée, exposée dans la cible et utilisée par le fantôme du `Reservoir` et par le dépôt ; vérifier dans le navigateur le scénario « Déposer une brique trop haute » (4 p × 3 sem. dans un vase de 3 → 3 p × 4 sem., fantôme recalé pendant le glisser)

## 5. Interface : dock, création, inspecteur, en-tête

- [x] 5.1 Composant dock (`ui/dock/`) fixé en bas, repliable, avec le nombre de projets, la charge totale et « tiendrait / ne tiendrait pas », mini-briques triées par charge décroissante et glissables, et une hauteur réservée en bas de page ; vérifier dans le navigateur les scénarios « Visible en bas de page » et « Dock replié »
- [x] 5.2 Glisser entre le dock, les vases et les bacs d'équipe : vérifier dans le navigateur « Remettre en commun », « Attribuer sans dater » et « Annuler » (Ctrl+Z après un dépôt depuis le dock)
- [x] 5.3 « + Caillou » du dock et `ProjectDialog` sans équipe (personnes bornées à 30, ni placement ni agrandissement de fenêtre) ; vérifier le scénario « Nouveau caillou sans équipe » (90 j/h sur 3 p arrive dans le dock, aucun vase ne change)
- [x] 5.4 Inspecteur : option « Aucune (bac commun) » dans la liste des équipes, et affichage correct d'un projet sans équipe sélectionné ; vérifier le scénario « Par l'inspecteur »
- [x] 5.5 Trier par charge décroissante le bac d'équipe du `Reservoir` ; vérifier le scénario « Les gros cailloux d'abord » dans un bac d'équipe et dans le dock
- [x] 5.6 En-tête : charge en attente des deux sortes de bac, « dont N j/h non attribués » ; vérifier le scénario « Total de l'en-tête » contre un calcul à la main

## 6. Interface : l'Étagère

- [x] 6.1 Sélecteur « Vases | Étagère » dans la barre d'outils, branché sur `ViewService.mode` ; le curseur de zoom et « Tout voir » pilotent le zoom du mode affiché ; vérifier les scénarios « Basculer », « Mode retenu » et « Zooms indépendants »
- [x] 6.2 Composant `ui/etagere/` : grille en-têtes + vases miniatures (16 px par personne, hauteur proportionnelle à l'effectif), règle du temps collante, ligne de la semaine en cours et surbrillance de la période sur tous les vases, briques avec nom, charge et forme au survol ; vérifier « Hauteur proportionnelle », « Semaines alignées » et « Survol d'une brique »
- [x] 6.3 En-têtes d'équipe (nom, effectif, jauge, taux, reste ou surcharge sur la période, pastille du bac d'équipe, compteur de débordement) ; vérifier « Indicateurs d'une équipe » et « Pastille d'attente » contre la jauge du mode Vases
- [x] 6.4 Bande des personnes libres au-dessus de la règle du temps, alignée sur les semaines, semaines saturées signalées ; vérifier « Somme des vases » et « Semaine saturée » dans le navigateur
- [x] 6.5 Signalements en miniature (débordement au-dessus du rebord, bords coupés, nombre de briques hors fenêtre de chaque côté) ; vérifier « Débordement en miniature » en réduisant l'effectif d'une équipe
- [x] 6.6 Lecture seule : désélection en entrant sur l'Étagère, aucun gestionnaire de clic ou de glisser sur les briques ni dans le dock, « + Caillou » inactif, Ctrl+Z / Ctrl+Y ignorés, Annuler, Rétablir, « Nouvelle équipe » et « Recharger la démo » masqués ; vérifier « Aucun geste » et « Dock en lecture seule »
- [x] 6.7 Vérifier en zoom maximal que la règle du temps reste visible au défilement vertical (risque `sticky` du design), et synchroniser règle et vases par `scrollLeft` si besoin
- [x] 6.8 Décrire le bac commun, le dock et l'Étagère dans le README ; vérifier que les libellés cités sont ceux de l'interface

## 7. Intégration

- [x] 7.1 `pnpm test` et `pnpm build` passent, sans dépassement des budgets de style (12 kB par composant)
- [x] 7.2 Parcours complet dans le navigateur : créer un projet dans le dock, le glisser dans un vase trop étroit, le renvoyer au dock, supprimer une équipe, passer sur l'Étagère et vérifier que ses chiffres égalent ceux du mode Vases

## Workflow follow-up

- Archiver le changement (`/opsx:archive`) une fois l'implémentation relue.
- Supprimer la branche locale `prototype/etagere` quand elle ne sert plus de référence.
