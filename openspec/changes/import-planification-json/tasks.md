# Tâches

## 1. Domaine : lecture de l'export JSON

- [x] 1.1 Créer `domain/planning-export.ts` avec les types `PlanningExport` et `ExportedProject` et `parsePlanningExport(data: unknown)` (décision 1 : lecture défensive, `null` sans `projets` ni `equipes`, noms nettoyés, semaines ramenées au lundi, valeurs ≤ 0 écartées, première équipe du projet, doublons de nom écartés) ; vérifier `pnpm build`
- [x] 1.2 Construire les métadonnées d'un projet exporté (décision 6 : « Code Projet », « Référence Externe », « Statut », « Chef de Projet », « Couleur », « Chiffres », « Commentaires » ; valeurs vides omises) ; vérifier `pnpm build`
- [x] 1.3 Écrire `planning-export.spec.ts` avec un petit export tiré des fichiers réels (3 projets, 2 équipes, un projet sans semaine, des commentaires) et les cas « JSON d'une autre forme », « nom vide », « nom en double », « équipe absente du projet » ; vérifier `pnpm test`

## 2. Domaine : cibles et comparaison

- [x] 2.1 Ajouter `targetOf(project, today)` (décision 2) avec les tests des scénarios « Partie à venir seulement » (C Bourse ACCESS : 16/11, 7 semaines, 6 j/h) et « Semaines éparses » (Maintenance : 07/12 → 04/01, 5 semaines, 0,6 j/h), et une cible nulle quand toutes les semaines sont passées ; vérifier `pnpm test`
- [x] 2.2 Créer `domain/planning-review.ts` avec `PlanningChoices`, `PlanningReview` et `reviewPlanning` : états, actions par défaut et actions possibles (tableau de la décision 3), conformité à 0,1 j/h près sans tenir compte de la ligne, détail des écarts, équipes à créer et projets absents de l'export ; vérifier `pnpm build`
- [x] 2.3 Écrire `planning-review.spec.ts`, un test par scénario des exigences « État de chaque projet », « Actions par défaut », « Équipes de l'export » et « Projets absents de l'export » (à poser, à jour malgré une autre ligne, écart de date, sans suite, non planifié vers le bac d'équipe, non planifié déjà posé laissé, équipe existante à la casse près, équipe à créer, projet absent signalé), plus un projet dans le bac d'une autre équipe marqué en écart ; vérifier `pnpm test`

## 3. Domaine : simulation de la pose et nouvel état

- [x] 3.1 Ajouter à `reviewPlanning` la simulation de la décision 4 (agrandissement de la fenêtre, briques qui restent, poses par début puis par nom, ligne la plus basse par `canOccupy` à colonne exacte, issue `tray` pour une pose sans place, `unchanged` pour un alignement sans place, pas de simulation pour une équipe sans effectif saisi) ; vérifier `pnpm build`
- [x] 3.2 Tester la simulation avec les scénarios « Ligne suivante », « Plus de place » et « Au-delà de la fenêtre » (52 → 54 semaines), une colonne de début négative quand la fenêtre est décalée vers le futur, et un alignement sans place qui laisse la brique en place ; vérifier `pnpm test`
- [x] 3.3 Créer `applyPlanning(state, review, newId)` (décision 5 : équipes créées, fenêtre agrandie, créations, poses, envois au bac d'équipe avec leur charge, alignements, métadonnées fusionnées, pierre d'après la couleur pour un nouveau projet) ; tester que l'état produit correspond exactement aux issues de la revue, que l'état d'entrée n'est pas modifié, que les métadonnées Excel sont gardées (scénario « Métadonnées complétées ») et que l'effectif d'une équipe existante ne change pas ; vérifier `pnpm test`

## 4. État et documentation

- [x] 4.1 Ajouter `PlanningStore.applyPlanning(review)` (sortie immédiate sans action, un seul `commit()`, message récapitulatif avec « Annuler ») et le signal non persisté `ViewService.planningSource` ; vérifier `pnpm build`
- [x] 4.2 Mettre à jour `GLOSSARY.md` (« Air » : arrondi aux cases entières, ou charge diluée dans le temps d'un projet importé ; « Import » : Excel et export de planification) et `CLAUDE.md` (`planning-export.ts`, `planning-review.ts`, règle de pose à date exacte, application en une fonction pure) ; vérifier que les noms cités existent dans le code

## 5. Interface

- [x] 5.1 Dock : `accept=".xlsx,.json"`, choix du lecteur selon l'extension, message pour un JSON qui n'est pas un export, ouverture de l'aperçu de comparaison ; vérifier dans le navigateur les scénarios « Export JSON », « JSON d'une autre forme » et, en non-régression, « Dépôt sur le dock » avec le `.xlsx`
- [x] 5.2 Créer `ui/planning-dialog/` (décision 7 : en-tête avec compteurs et effectifs des équipes à créer, groupes par équipe, lignes avec état, cible, écart, issue et choix d'action, projets absents de l'export en fin de groupe, récapitulatif et « Appliquer » désactivé tant qu'un effectif manque) ; l'ajouter à `app.html` ; vérifier `pnpm build` sans dépasser le budget de style de 12 kB

## 6. Vérifications d'ensemble

- [x] 6.1 Dans le navigateur, partir de l'import Excel du fichier `Export_Projets_Filtrés`, puis importer `planification_2026-11-16 (1).json` : saisir les effectifs d'Aurora et de BRSU, constater les compteurs, appliquer, puis vérifier que les briques sont posées à leurs dates exactes, que les non planifiés sont dans les bacs d'équipe, que l'air est hachuré et que les métadonnées sont complétées dans l'inspecteur
- [x] 6.2 Annuler une seule fois (Ctrl+Z) et constater le retour à l'état d'avant, équipes créées comprises ; ré-importer le même JSON après application et constater que les projets posés sont « à jour » ; fermer un aperçu sans valider et constater que ni le planning ni l'historique ne changent
- [x] 6.3 Lancer `pnpm test` et `pnpm build` (aucun nouvel avertissement de budget) ; mettre à jour le README (import d'un export de planification)

## Workflow follow-up

- Archiver le change (`/opsx:archive`) une fois l'implémentation revue.
