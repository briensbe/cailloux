# Tâches

## 1. Domaine : métadonnées et identité par le nom

- [x] 1.1 Ajouter `meta?: Record<string, string>` à `Project` dans `domain/model.ts` (commentaire : colonnes d'origine d'un projet importé, transportées sans être interprétées) ; vérifier que `pnpm build` passe sans autre changement
- [x] 1.2 Créer `domain/names.ts` avec `cleanName`, `nameKey` et `headerKey` (design, décision 2), et `names.spec.ts` : espaces en trop, espace insécable, casse, NFC contre NFD, accents gardés dans `nameKey` (« Etude » ≠ « Étude ») mais ignorés dans `headerKey` (« Référence Externe » = « reference  externe ») ; vérifier `pnpm test`

## 2. Domaine : pierres et plan d'import

- [x] 2.1 Ajouter `nearestStone(hex)` (distance OKLab, `null` si l'hexadécimal est invalide) avec un test qui fixe la pierre des 15 couleurs de l'export réel (`#22c55e` → jade, `#3b82f6` → lapis, `#eab308` → ocre, `#ef4444` → terre cuite, etc.) et les formats `#rgb`, `#rrggbb`, invalide ; vérifier `pnpm test`
- [x] 2.2 Créer `domain/import.ts` : `findNameColumn(headers)` (`nom projet`, sinon `nom`, sinon `null`) et `reviewImport(table, existing, choices, firstColorIndex)` avec les règles et la coche de la décision 3, les métadonnées (valeurs non vides de toutes les colonnes sauf le nom, sous l'en-tête d'origine), la charge (saisie de la ligne, sinon charge par défaut), la pierre (couleur d'origine, sinon rotation du bac commun) et les totaux (nombre et charge des lignes cochées) ; vérifier `pnpm build`
- [x] 2.3 Écrire `import.spec.ts` avec un scénario de la spec par test : colonnes dans un autre ordre, ligne vide ignorée, espaces et casse (« déjà présent »), nom nettoyé, ré-import (projet posé dans un vase compté comme existant), doublon dans le fichier puis renommage qui le rend importable, écarter puis retenir « En pause » (lignes recochées, choix manuels de ce statut effacés), charge par défaut et charge saisie, métadonnées d'une ligne sans description, couleur absente (rotation à partir de `firstColorIndex`) ; vérifier `pnpm test`

## 3. Lecture des fichiers `.xlsx`

- [x] 3.1 Créer `src/app/io/xlsx.ts` avec `readFirstSheet(data)` (décision 5 : ZIP par le répertoire central, méthodes 0 et 8, première feuille d'après `workbook.xml` et ses relations, chaînes partagées avec texte enrichi, cellules placées d'après leur référence, tableau rectangulaire) et une erreur dédiée pour un fichier illisible ; vérifier `pnpm build`
- [x] 3.2 Écrire `io/xlsx.spec.ts` avec un utilitaire ZIP minimal propre au test : archive stockée, archive compressée (`CompressionStream('deflate-raw')`), cellules manquantes (`A1`, `C1` sans `B1`), chaîne en ligne (`inlineStr`), texte enrichi en plusieurs `<t>`, feuille qui n'est pas `sheet1.xml`, et un PDF qui lève l'erreur ; vérifier `pnpm test` (si `DecompressionStream` manque sous jsdom, l'importer depuis `node:stream/web`)
- [x] 3.3 Vérifier la lecture sur le vrai fichier : dans le navigateur, lire `private/Export_Projets_Filtrés_2026-11-16.xlsx` et constater 126 lignes (en-têtes compris), 7 colonnes, et des accents corrects (« Fermeture anticipée des places »)

## 4. État : import dans le store et ouverture de l'aperçu

- [x] 4.1 Ajouter `PlanningStore.importProjects(lines)` (décision 6 : sortie immédiate si la liste est vide, `initialDims(charge, 1)`, mode `free`, bac commun, un seul `commit()`, sélection inchangée, toast « N projets importés dans le bac commun » avec Annuler) ; vérifier `pnpm build`
- [x] 4.2 Ajouter à `ViewService` le signal non persisté `importSource: { fileName: string; table: string[][] } | null` ; vérifier qu'il n'apparaît pas dans `cailloux.view.v1` après rechargement
- [x] 4.3 Mettre à jour `CLAUDE.md` : champ `meta` (immuable, jamais interprété, pas de nouvelle clé de stockage), identité des projets par `nameKey` à réutiliser pour tout rapprochement (import des JSON), dossier `io/` testé lui aussi ; et le glossaire (`GLOSSARY.md`) : entrée « Métadonnées » ; vérifier que les noms cités existent dans le code

## 5. Interface : dock, aperçu, inspecteur

- [x] 5.1 Dock : bouton « Importer… » avec `<input type="file" accept=".xlsx">` caché (valeur remise à vide après choix), dépôt de fichier natif (`dragenter`/`dragover`/`dragleave`/`drop` filtrés sur `Files`, signal `fileOver` qui éclaire le dock), désactivés en mode Étagère, lecture puis ouverture de l'aperçu ou toast d'erreur (fichier illisible, pas de colonne de nom) ; garde-fou `dragover`/`drop` sur `window` ; vérifier dans le navigateur les scénarios « Dépôt sur le dock », « Bouton Importer », « Étagère en lecture seule », « Mauvais format » et qu'un fichier lâché hors du dock ne fait pas quitter l'application
- [x] 5.2 Créer `ui/import-dialog/` (décision 7) : en-tête (fichier, charge par défaut, puces de statut avec leur nombre), tableau défilant (coche, nom modifiable, pastille de pierre, charge modifiable, état, statut), pied (N projets · X j/h · tiendrait / ne tiendrait pas via `commonWaiting`), « Annuler » et « Importer N projets » désactivé à zéro ; l'ajouter à `app.html` ; vérifier `pnpm build` sans dépasser le budget de style de 12 kB
- [x] 5.3 Vérifier l'aperçu dans le navigateur avec le vrai fichier : 3 noms en double signalés (dont « Trajectoire mobile vers RSW - AppToApp CRCA »), renommage qui rend la seconde ligne importable, écarter « En pause » retire 6 lignes du total, fermer sans valider ne change ni le planning ni l'historique (Ctrl+Z inactif s'il l'était)
- [x] 5.4 Inspecteur : section repliable « Métadonnées » (`<details>`, `<dl>`, valeurs en `pre-line`) affichée seulement si `meta` a des entrées ; vérifier dans le navigateur les scénarios « Projet importé » et « Projet créé à la main »

## 6. Vérifications d'ensemble

- [x] 6.1 Import complet du vrai fichier dans le navigateur : nombre de projets créés égal au nombre de lignes cochées, triés par charge dans le dock, toast affiché ; un seul Ctrl+Z les retire tous ; ré-importer le même fichier marque toutes les lignes « déjà présent »
- [x] 6.2 Persistance : poser un projet importé dans un vase, recharger la page, vérifier qu'il garde ses métadonnées ; puis recharger avec une sauvegarde `cailloux.state.v2` antérieure au changement et vérifier qu'elle se charge sans perte (scénario « Ancienne sauvegarde »)
- [x] 6.3 Lancer `pnpm test` et `pnpm build` (aucun avertissement de budget nouveau) ; mettre à jour le README (import d'un export Excel dans le bac commun)

## Workflow follow-up

- Archiver le change (`/opsx:archive`) une fois l'implémentation revue.
