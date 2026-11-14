# Tâches

## 1. Domaine : dates et fenêtre

- [x] 1.1 Ajouter `weeksBetween` et `addWeeks` (calcul en UTC) dans `domain/weeks.ts`, avec des tests qui traversent un changement d'heure (fin octobre, fin mars) ; vérifier `pnpm test`
- [x] 1.2 Faire évoluer le modèle (`Project.start` à la place de `col`, suppression de `Team.horizon`, `PlanningState.window = { start, weeks }`) et ajouter `effectiveWindowStart` (lundi courant si `start` est `null`) avec ses tests ; vérifier que `pnpm build` ne signale plus que les usages à migrer
- [x] 1.3 Ajouter `toWindowRect(project, windowStart)` (colonne négative ou au-delà autorisée) avec ses tests, dont une brique coupée à gauche et une brique entièrement hors fenêtre ; vérifier `pnpm test`
- [x] 1.4 Ajouter une colonne minimale à `findFirstFit` et une colonne plancher à `compact` (briques antérieures fixes, aucune brique ne descend sous le plancher), avec leurs tests ; vérifier `pnpm test`
- [x] 1.5 Ajouter le calcul de l'allongement minimal de fenêtre pour faire tenir un projet, avec ses tests (déjà tient → 0, ne tient qu'en allongeant → k minimal) ; vérifier `pnpm test`
- [x] 1.6 Réécrire `demo.ts` avec des dates relatives au lundi courant, dont une brique déjà commencée et une brique hors fenêtre ; vérifier par un test qu'aucune brique de la démo ne se chevauche

## 2. Domaine : période et indicateurs

- [x] 2.1 Créer `domain/period.ts` : type période (début lundi + nombre de semaines), périodes prédéfinies (3, 13, 26, 52 semaines depuis la semaine en cours), période personnalisée à partir de deux dates quelconques ramenées aux semaines entières ; tests des scénarios « Six mois » et « Saisie de deux dates » ; vérifier `pnpm test`
- [x] 2.2 Ajouter `periodOverlap` et le calcul des indicateurs d'une équipe (capacité, charge planifiée, air, taux, restante, charge en attente, « tiendrait ») ; tests des scénarios « Brique à cheval », « L'air compte comme réservé », « Ne tiendrait pas » et d'une surcharge par brique en débordement ; vérifier `pnpm test`
- [x] 2.3 Ajouter la carte d'occupation d'une période (cases libres, plus grand rectangle libre dans la période), avec ses tests ; vérifier `pnpm test`

## 3. État

- [x] 3.1 Passer `PlanningStore` à la nouvelle clé `cailloux.state.v2` et au nouveau modèle (`occupancy` via `toWindowRect`, conversion colonne → date dans `moveProject`, `nudge`, `placeProject`, `moveToTeam`) ; vérifier dans le navigateur qu'une ancienne sauvegarde v1 est ignorée et que la démo s'affiche
- [x] 3.2 Ajouter les actions de fenêtre (décaler d'une semaine, revenir à aujourd'hui, allonger / raccourcir d'une semaine sans minimum autre que 1), annulables ; vérifier Ctrl+Z après un raccourcissement
- [x] 3.3 Retirer l'envoi au bac de `setTeamSize` (l'effectif change seul) et du raccourcissement de fenêtre ; vérifier dans le navigateur qu'une réduction d'équipe laisse la brique de la 5ᵉ ligne à sa place
- [x] 3.4 Faire partir `addProject` et `compactTeam` de la semaine en cours, et ajouter « agrandir la fenêtre et poser » ; vérifier qu'un tassement ne déplace pas une brique commencée
- [x] 3.5 Ajouter à `ViewService` la période sélectionnée (3 mois par défaut, persistée comme le zoom) et le mode « tout voir » ; vérifier que la période est retrouvée après rechargement
- [x] 3.6 Mettre à jour les invariants de `CLAUDE.md` (bac, débordement, fenêtre, clé de stockage) et le README ; vérifier que les commandes et termes cités existent dans le code

## 4. Interface : fenêtre

- [x] 4.1 Barre d'outils : remplacer « Semaine de départ » par le décalage de fenêtre (‹ semaine, « aujourd'hui », semaine ›) et le réglage « − N semaines + » ; supprimer le réglage d'horizon des vases ; vérifier que tous les vases suivent la fenêtre
- [x] 4.2 Mode « tout voir » et zoom sous 36 px, avec rendu compact des briques étroites (couleur seule, détail au survol) ; vérifier qu'une fenêtre de 52 semaines tient sans défilement horizontal
- [x] 4.3 Dessiner l'intersection brique ∩ fenêtre avec bords coupés (`cut-start` / `cut-end`), poignée de fin masquée sur un bord coupé et dates réelles au survol ; vérifier avec la brique déjà commencée de la démo
- [x] 4.4 Pastilles hors fenêtre au bord des vases (nombre, noms au survol, clic qui décale ou allonge la fenêtre) et total dans l'en-tête ; vérifier avec la brique hors fenêtre de la démo
- [x] 4.5 Débordement : hauteur réservée au-dessus du rebord, contour d'alerte, compteur par vase et avertissement global ; vérifier en réduisant l'effectif de Galets
- [x] 4.6 « Nouveau caillou » : placement à partir de la semaine en cours et bouton « Agrandir la fenêtre pour le faire tenir » quand le vase déborde ; vérifier avec un projet de 300 j/h sur 1 personne

## 5. Interface : période

- [x] 5.1 Sélecteur de période (3 semaines, 3 mois, 6 mois, 12 mois, personnalisée) avec deux champs de date pour la période personnalisée, et surbrillance des colonnes de la période dans tous les vases ; vérifier que la surbrillance suit le choix
- [x] 5.2 Sélection d'une période personnalisée à la souris sur l'axe du temps ; vérifier qu'un glisser de la semaine 3 à 7 donne 5 semaines
- [x] 5.3 Jauge de chaque vase sur la période (capacité, charge planifiée dont air, taux, restante ou surcharge, charge en attente et « tiendrait ») et totaux dans l'en-tête ; vérifier les chiffres de la démo contre un calcul à la main
- [x] 5.4 « Le vase est-il plein ? » limité à la période (eau dans les seules colonnes de la période, réponse et plus gros caillou calculés sur la période) ; vérifier sur « 3 semaines »

## 6. Vérification d'ensemble

- [x] 6.1 Dérouler les scénarios des trois specs dans le navigateur (glisser-déposer d'un vase à l'autre, redimensionnement dans les deux modes, fenêtre décalée dans le passé, réduction d'équipe, raccourcissement de fenêtre) et vérifier qu'aucune brique ne se chevauche
- [x] 6.2 Vérifier `pnpm test` et `pnpm build` sans avertissement de budget

## Workflow follow-up

- Relire le changement, puis l'archiver avec `/opsx:archive` une fois validé.
