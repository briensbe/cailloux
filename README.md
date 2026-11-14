# Cailloux — le vase est-il plein ?

Visualiser la capacité des équipes de dev avec la métaphore du professeur et de son vase :
les gros cailloux d'abord, puis les petits, le sable, l'eau.

- **Un vase par équipe** : la hauteur = l'effectif, la largeur = la fenêtre de semaines, commune à toutes les équipes
  (52 semaines glissantes par défaut, ajustable semaine par semaine, décalable vers le passé ou le futur, « tout voir »).
- **Un projet = une brique** ancrée sur une vraie semaine de début : largeur = semaines, hauteur = personnes en parallèle,
  surface = charge (1 case = 5 j/h). Les projets hors de la fenêtre gardent leurs dates et sont signalés au bord du vase.
- **Une période d'analyse** (3 semaines, 3, 6 ou 12 mois, ou des dates au choix) : capacité, charge planifiée (dont l'air),
  taux de remplissage, capacité restante et charge en attente, par équipe et au total. Vocabulaire : [GLOSSARY.md](GLOSSARY.md).
- **Deux modes de redimensionnement** :
  - _Libre_ : on étire comme on veut, la charge suit la surface.
  - _Charge fixe_ : la surface est imposée ; plus de semaines = moins de personnes, et inversement.
- **Glisser-déposer aimanté** : la brique se colle à la place libre la plus proche, jamais de chevauchement,
  y compris d'un vase à l'autre. Un bac « hors du vase » accueille les projets qu'on y range.
- **Aucune saisie perdue** : réduire une équipe ou raccourcir la fenêtre ne déplace rien ; les briques concernées
  sont signalées (débordement, hors fenêtre).
- **« Le vase est-il plein ? »** verse l'eau dans les interstices de la période et répond avec la capacité restante
  et le plus gros projet qui passe encore.

Les décisions d'architecture sont consignées dans [docs/adr](docs/adr).

## Prérequis

- Node.js 24 (version utilisée par la CI)
- pnpm 12.18 (fixé dans `packageManager` ; `corepack enable` suffit à l'activer)

## Lancer

```bash
pnpm install
pnpm start          # serveur de dev sur http://localhost:4200
pnpm test           # tests unitaires (Vitest) du cœur métier
pnpm build          # build de production dans dist/cailloux/browser
```

Stack : Angular 21 (composants standalone, signals), TypeScript 5.9, Vitest + jsdom.
Les données sont stockées uniquement dans le navigateur (`localStorage`) : pas de backend.

## Organisation du code

| Dossier             | Rôle                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- |
| `src/app/domain`    | Métier pur, sans Angular : capacité, géométrie du vase, calendrier, données de démo.   |
| `src/app/state`     | Store à base de signals (historique Ctrl+Z, sauvegarde `localStorage`), drag & drop.   |
| `src/app/ui`        | Composants : vase, brique, inspecteur, fenêtre « Nouveau caillou », calque de drag.    |

Raccourcis : flèches pour pousser la brique sélectionnée, `Suppr` pour la retirer, `Ctrl+Z` / `Ctrl+Y`.

## Publier sur GitHub Pages

Le workflow GitHub Actions (`.github/workflows/deploy.yml`) est **déclenché manuellement** : onglet **Actions** > _Deploy to GitHub Pages_ > **Run workflow**.
Le déclenchement automatique sur push est désactivé ; pour le réactiver, ajouter un trigger `push` sur `main` dans la section `on:` du workflow.
Le `--base-href` est calculé automatiquement à partir du nom du dépôt.
Dans les paramètres du dépôt, choisir **Settings > Pages > Build and deployment > Source: GitHub Actions**.

Pour ce dépôt, l'application sera disponible à l'adresse <https://briensbe.github.io/cailloux/>.
