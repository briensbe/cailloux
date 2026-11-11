# Cailloux — le vase est-il plein ?

Visualiser la capacité des équipes de dev avec la métaphore du professeur et de son vase :
les gros cailloux d'abord, puis les petits, le sable, l'eau.

- **Un vase par équipe** : la hauteur = le nombre de personnes, la largeur = l'horizon en semaines.
- **Un projet = une brique** : largeur = semaines, hauteur = personnes en parallèle, surface = charge (1 case = 5 j/h).
- **Deux modes de redimensionnement** :
  - _Libre_ : on étire comme on veut, la charge suit la surface.
  - _Charge fixe_ : la surface est imposée ; plus de semaines = moins de personnes, et inversement.
- **Glisser-déposer aimanté** : la brique se colle à la place libre la plus proche, jamais de chevauchement,
  y compris d'un vase à l'autre. Un bac « hors du vase » accueille ce qui ne tient pas.
- **« Le vase est-il plein ? »** verse l'eau dans les interstices et répond avec la capacité restante
  et le plus gros projet qui passe encore.

## Lancer

```bash
npm install
npm start          # http://localhost:4200
npm test           # tests unitaires (Vitest) du cœur métier
```

## Organisation du code

| Dossier             | Rôle                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- |
| `src/app/domain`    | Métier pur, sans Angular : capacité, géométrie du vase, calendrier, données de démo.   |
| `src/app/state`     | Store à base de signals (historique Ctrl+Z, sauvegarde `localStorage`), drag & drop.   |
| `src/app/ui`        | Composants : vase, brique, inspecteur, fenêtre « Nouveau caillou », calque de drag.    |

Raccourcis : flèches pour pousser la brique sélectionnée, `Suppr` pour la retirer, `Ctrl+Z` / `Ctrl+Y`.
