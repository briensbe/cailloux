# Design

## Context

Voir `proposal.md` pour la motivation et la spec `import-projets` pour le comportement attendu.

État actuel du code :

- `Project` n'a pas de champ libre : nom, charge, forme, mode, couleur (une des 8 pierres de `STONES`), équipe, dates. `PlanningStore.addProject(null, draft)` crée un projet dans le bac commun, un par un, avec un `commit()` par projet.
- `loadState()` ne vérifie l'état sauvegardé que superficiellement (tableaux `teams` et `projects`, `window.weeks`). Un champ facultatif en plus ne le gêne pas.
- Le dock (`ui/dock`) est une zone de dépôt pour les briques, gérée par le `DragService` à base de Pointer Events. Il n'écoute aucun événement de glisser-déposer natif (HTML5).
- `commonWaiting(projects, teams)` (`domain/period.ts`) donne déjà la charge du bac commun, la capacité restante de toutes les équipes sur la période et `fits`. Le dock l'affiche.
- `App.onKey` ignore les raccourcis quand le focus est dans un `dialog`. `ProjectDialog` est un `<dialog>` ouvert par un signal de `ViewService` (`newProjectFor`).
- Aucune librairie de lecture de tableur n'est installée. Le budget de production est de 500 kB pour le bundle initial et de 12 kB de style par composant.
- Les fichiers réels (125 lignes) ont été examinés : 13 noms ont des espaces en trop, 3 noms apparaissent deux fois, aucune colonne de charge, 15 couleurs hexadécimales différentes. Les 59 projets des deux exports JSON se retrouvent tous dans l'Excel par leur nom nettoyé (espaces et casse), sans avoir besoin d'ignorer les accents.

## Goals / Non-Goals

**Goals :**

- Toute la logique de l'import (colonnes, identité, doublons, pierres, filtres, charges, bilan) en fonctions pures du domaine, testées. Le dialogue ne fait qu'afficher et transmettre des choix.
- Une seule fonction d'identité par le nom (`nameKey`), que l'import des JSON réutilisera telle quelle.
- Aucune nouvelle dépendance npm.

**Non-Goals :**

- Signaler visuellement les projets dont la charge est celle par défaut (« à chiffrer ») : utile, mais cela demande une règle de spec à part. À traiter avec l'import des JSON, qui apportera les vraies charges.
- Lire les dates et nombres Excel comme tels : les métadonnées sont du texte transporté, pas des valeurs interprétées.
- Virtualiser la liste de l'aperçu : quelques centaines de lignes s'affichent sans difficulté.

## Decisions

### 1. `meta?: Record<string, string>` sur `Project`, sans changer de clé de stockage

Un dictionnaire facultatif, dont les clés sont les en-têtes de colonne tels qu'ils apparaissent dans le fichier (« Code Projet », « Référence Externe »…). Les projets créés à la main n'ont pas de `meta`. Une sauvegarde `cailloux.state.v2` existante est donc déjà valide dans le nouveau format : pas de migration, pas de nouvelle clé.

Comme le reste de l'état, `meta` est immuable : aucune opération du store n'y touche. Les copies `{ ...p, ... }` existantes la conservent par référence, ce qui ne coûte rien et suffit pour l'annulation.

_Alternatives écartées_ : des champs typés (`code`, `ref`, `chef`…), qui figeraient le format d'un export que l'on ne maîtrise pas, et qui perdraient toute colonne nouvelle ; un stockage séparé `metaById` dans `PlanningState`, qui obligerait chaque suppression de projet à nettoyer une seconde structure.

### 2. Deux normalisations distinctes : noms de projet et en-têtes

- `nameKey(name)` (`domain/names.ts`) : normalisation Unicode NFC, espaces (y compris l'espace insécable, que `\s` reconnaît en JavaScript) réduits à un seul, bords retirés, minuscules avec `toLocaleLowerCase('fr-FR')`. Les accents sont **gardés** : « Etude » et « Étude » restent deux projets. La NFC n'est pas un écart à la spec : elle rend identiques deux écritures invisiblement différentes du même « é », que l'utilisateur ne peut pas distinguer.
- `cleanName(name)` : NFC, retrait des espaces de début et de fin. C'est le nom stocké.
- `headerKey(header)` : comme `nameKey`, mais sans les accents (décomposition NFD puis suppression des marques diacritiques). Les en-têtes sont des libellés techniques : « Référence Externe » et « Reference externe » doivent désigner la même colonne. La colonne de nom est celle dont la clé vaut `nom projet`, sinon `nom`.

_Alternative écartée_ : ignorer aussi les accents dans les noms de projet. Les données réelles n'en ont pas besoin, et ce serait fusionner à tort deux projets qui ne diffèrent que par un accent.

### 3. Le plan d'import est une fonction pure, recalculée à chaque choix

Le dialogue ne garde que les choix de l'utilisateur dans des signals :

```ts
interface ImportChoices {
  defaultCharge: number;                 // 5 au départ
  excludedStatuses: ReadonlySet<string>; // valeurs de « Statut » écartées
  overrides: ReadonlyMap<number, { name?: string; charge?: number; checked?: boolean }>; // par n° de ligne
}
```

et un `computed()` appelle `reviewImport(table, existing, choices, firstColorIndex)` (`domain/import.ts`), qui renvoie chaque ligne avec son nom final, sa clé, ses métadonnées, sa pierre, sa charge, son état (`new` | `existing` | `duplicate` | `ignored`) et sa coche, plus les totaux. Comme tout est recalculé, renommer une ligne en doublon la fait redevenir `new` sans code particulier.

Règles appliquées dans l'ordre :

1. Nom vide après `cleanName` → `ignored`.
2. Clé présente parmi les projets existants (toutes équipes, posés ou non) → `existing`.
3. Clé déjà prise par une ligne précédente du fichier qui est `new` → `duplicate`.
4. Sinon → `new`.
5. Coche = `new` et statut non écarté, sauf si l'utilisateur a coché ou décoché la ligne à la main (`overrides.checked`). Écarter ou retenir un statut efface ces choix manuels pour les lignes de ce statut : c'est ce qui permet de « recocher » les lignes importables, comme le demande la spec.

Une ligne `existing`, `duplicate` ou `ignored` n'est jamais cochée, même si `overrides.checked` vaut `true`.

_Alternative écartée_ : calculer le plan une fois à l'ouverture, puis modifier les lignes à la main dans le composant. Il faudrait alors réécrire dans l'interface la logique des doublons à chaque renommage, sans test.

### 4. La pierre la plus proche dans l'espace OKLab

`nearestStone(hex): StoneColor | null` (`domain/stones.ts`) compare la couleur à la `base` de chaque pierre dans l'espace OKLab, avec un poids de 0,3 sur la luminosité. Les pierres sont sombres et peu saturées, les couleurs importées vives : à poids plein, la luminosité l'emporterait sur la teinte. Elle renvoie `null` si la valeur n'est pas un hexadécimal valide (`#rgb` ou `#rrggbb`). Dans ce cas, la pierre suit la rotation du bac commun : `STONE_COLORS[(firstColorIndex + i) % 8]`, où `firstColorIndex` vaut le nombre de projets du bac commun et `i` le rang de la ligne parmi celles sans couleur. C'est la même règle que `store.nextColor(null)`, étendue à plusieurs projets.

Le test fixe la correspondance des 15 couleurs du fichier réel, par exemple `#22c55e` → jade, `#3b82f6` → lapis, `#eab308` → ocre, `#ef4444` → terre cuite.

_Alternatives écartées_ : la distance RVB pondérée « redmean », d'abord retenue, qui envoyait le lavande et le vert citron du fichier réel vers le Grès et l'Ocre ; une comparaison de teinte seule (TSL), qui départage mal les pierres peu saturées (Ardoise, Grès, Basalte) ; une table de correspondance écrite à la main, qui casserait au premier export d'une autre couleur.

### 5. Un lecteur `.xlsx` maison, sans dépendance

Un `.xlsx` est une archive ZIP de fichiers XML. `src/app/io/xlsx.ts` expose `readFirstSheet(data: ArrayBuffer): Promise<string[][]>` :

1. **ZIP** : chercher l'enregistrement de fin d'archive (signature `0x06054b50`) en partant de la fin, parcourir le répertoire central, puis lire chaque entrée utile depuis son en-tête local. Méthode 0 (stockée) : copie ; méthode 8 (deflate) : `new Response(blob.stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()`. Toute autre méthode, une archive chiffrée ou ZIP64 → erreur « fichier illisible ».
2. **Première feuille** : `xl/workbook.xml` donne la première `<sheet>` et son `r:id` ; `xl/_rels/workbook.xml.rels` donne son chemin. On ne suppose pas `sheet1.xml`.
3. **Chaînes partagées** : `xl/sharedStrings.xml` (facultatif), chaque `<si>` étant la concaténation de ses `<t>` (le texte enrichi est découpé en plusieurs `<r><t>`).
4. **Cellules** : pour chaque `<row>`, chaque `<c r="B2" t="…">`. La colonne vient de la référence `r` (les cellules vides sont absentes : on ne compte pas sur leur position). Type `s` : chaîne partagée ; `inlineStr` : `<is>` ; `str`, `n`, `b` et sans type : le texte brut de `<v>`.

L'analyse XML passe par `DOMParser` (`application/xml`), en cherchant par nom local pour ne pas dépendre des préfixes d'espace de noms. Le résultat est un tableau rectangulaire de chaînes (les cases manquantes valent `''`), que `reviewImport` consomme.

Ce module est hors de `domain/` parce qu'il dépend d'API du navigateur (`DOMParser`, `DecompressionStream`), mais il est testé : jsdom fournit `DOMParser`, et Node fournit `CompressionStream` et `DecompressionStream`. Le test fabrique de petites archives avec un utilitaire ZIP minimal (une entrée stockée, une entrée compressée avec `CompressionStream('deflate-raw')`), sans fichier binaire dans le dépôt.

_Alternatives écartées_ : **SheetJS**, dont la version publiée sur npm (0.18.5) n'est plus mise à jour et a des failles connues (les versions corrigées ne sont distribuées que par le CDN de l'éditeur), pour plusieurs centaines de kB ; **ExcelJS**, plus lourd encore et pensé pour Node ; un chargement différé (`import()`) de l'une ou l'autre, qui protège le bundle initial mais garde la dépendance et ses failles.

### 6. Store : `importProjects` avec un seul `commit()`

```ts
importProjects(lines: ImportDraft[]): void // ImportDraft = { name, charge, color, meta }
```

Sort tout de suite si la liste est vide. Sinon construit chaque projet avec `initialDims(charge, 1)`, `mode: 'free'`, `teamId: null`, `start = row = null`, `newId('p')`, et ajoute le tout en un seul `commit()`. La sélection ne change pas. Message : « N projets importés dans le bac commun », action « Annuler » → `undo()`.

Le store ne refait pas le contrôle des doublons : c'est le rôle du plan d'import, qui a été calculé sur l'état courant. Le dialogue étant modal, l'état ne peut pas changer entre l'aperçu et la validation.

### 7. Interface : dépôt natif sur le dock, dialogue d'aperçu, section de l'inspecteur

- **Dock** : écouteurs `dragenter`, `dragover`, `dragleave` et `drop` natifs, actifs seulement si `dataTransfer.types` contient `Files` et que le mode n'est pas l'Étagère. `dragover` appelle `preventDefault()`, sans quoi le navigateur refuse le dépôt. Un signal `fileOver` éclaire le dock, avec le même style que `active`. Ces événements ne croisent pas le `DragService`, qui écoute les Pointer Events. Bouton « Importer… » à côté de « + Caillou », relié à un `<input type="file" accept=".xlsx">` caché, dont la valeur est remise à vide après chaque choix pour pouvoir choisir deux fois le même fichier.
- **Garde-fou global** : `dragover` et `drop` sur `window` appellent `preventDefault()` quand le glisser porte des fichiers. Sinon, lâcher un fichier à côté du dock ferait ouvrir le fichier par le navigateur, qui quitterait l'application.
- **Lecture** : le dock lit le fichier (`file.arrayBuffer()` puis `readFirstSheet`). En cas d'erreur ou sans colonne de nom, il affiche un message et n'ouvre rien. Sinon, il passe `{ fileName, table }` à `ViewService.importSource`, un signal non persisté qui sert aussi d'indicateur « dialogue ouvert ».
- **`ui/import-dialog/`** : un `<dialog>` modal comme `ProjectDialog`. En-tête : nom du fichier, charge par défaut, filtre par statut (une puce par valeur, avec son nombre de lignes). Corps : un tableau qui défile (case à cocher, nom modifiable, pastille de pierre, charge modifiable, état, statut). Pied : « N projets · X j/h · tiendrait / ne tiendrait pas », calculé avec `commonWaiting` (charge actuelle du bac commun + X, comparée à la capacité restante), puis « Annuler » et « Importer N projets ». Les styles réutilisent les classes globales (`.btn`…) pour rester sous le budget de 12 kB.
- **Inspecteur** : quand `p.meta` a au moins une entrée, une section repliable « Métadonnées » (`<details>`) avec une liste `<dl>`. Valeurs en `white-space: pre-line` (les descriptions ont des retours à la ligne). L'interpolation d'Angular échappe le HTML : le balisage Jira présent dans les descriptions s'affiche comme du texte, sans risque d'injection.

## Risks / Trade-offs

- [Un export Excel aux particularités non prévues (ZIP64, chiffrement, feuille au format binaire `.xlsb`)] → Message « fichier illisible », planning inchangé. Les exports de l'outil source sont simples (une feuille, des chaînes).
- [Les dates et nombres d'Excel arrivent bruts dans les métadonnées (numéro de série d'une date, par exemple)] → Acceptable : les métadonnées sont transportées, pas interprétées. L'export actuel ne contient que du texte.
- [Des descriptions longues alourdissent la sauvegarde et l'historique] → Environ 50 kB pour 125 projets, loin de la limite de `localStorage`. L'historique partage les objets `Project` non modifiés, donc les métadonnées ne sont pas copiées à chaque `commit()`.
- [L'unicité du nom n'est contrôlée qu'à l'import : un projet créé ou renommé à la main peut porter le nom d'un autre] → Hors périmètre, assumé. L'import des JSON devra gérer un nom qui désigne plusieurs projets (par exemple en le signalant comme ambigu).
- [Les 125 projets à 5 j/h forment dans le dock un mur de briques identiques] → Le filtre par statut et le décochage limitent l'import ; les charges réelles arriveront avec l'import des JSON.
- [`DecompressionStream` absent de l'environnement de test] → Disponible en global dans Node depuis la version 18 et dans tous les navigateurs actuels. Si l'environnement jsdom de Vitest le masque, l'importer explicitement depuis `node:stream/web` dans le test.

## Migration Plan

Aucune migration : `meta` est facultatif et la clé `cailloux.state.v2` ne change pas. Retour arrière : le code précédent ignore le champ `meta` des projets importés, qui restent des projets valides du bac commun.
