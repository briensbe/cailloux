# Cailloux

Visualisation de la capacité des équipes de développement : chaque équipe est un vase que l'on remplit de projets, des plus gros aux plus petits.

## Langage

### Vase et briques

**Vase** :
La représentation d'une équipe : sa hauteur est son effectif, sa largeur la fenêtre de temps.
_À éviter_ : réservoir, swimlane

**Brique** :
Un projet posé dans un vase, ancré sur une semaine de début réelle : largeur en semaines, hauteur en personnes en parallèle.
_À éviter_ : tâche, ticket, bloc

**Effectif** :
Le nombre de personnes d'une équipe, qui peut changer à une date donnée (arrivée, départ).
_À éviter_ : taille d'équipe, ETP

**Bac d'attente** :
L'endroit, hors des vases, où l'on range les projets sans dates. Il en existe deux sortes : le bac commun et le bac de chaque équipe. Ce n'est pas une liste priorisée.
_À éviter_ : backlog, corbeille, hors-vase

**Bac commun** :
Le bac d'attente partagé par toutes les équipes : il contient les projets qu'aucune équipe n'a encore pris.
_À éviter_ : pool, backlog global

**Bac d'équipe** :
Le bac d'attente d'un vase : il contient les projets attribués à cette équipe mais sans dates, qu'on y a mis volontairement ou qui n'ont pas trouvé de place.
_À éviter_ : hors du vase

**Étagère** :
Tous les vases en miniature, alignés sur une même règle du temps, pour comparer les équipes d'un coup d'œil ; leur hauteur reste proportionnelle à l'effectif.
_À éviter_ : vue d'ensemble, tableau de bord, portefeuille

**Débordement** :
L'état d'une brique qui occupe des personnes que l'effectif ne compte plus, après une baisse d'effectif : elle reste en place et est signalée.
_À éviter_ : conflit, erreur

**Hors fenêtre** :
L'état d'une brique dont tout ou partie des semaines tombe avant ou après la fenêtre affichée : elle garde ses dates et est signalée au bord du vase.
_À éviter_ : masquée, perdue

### Capacité

**Capacité** :
Le travail qu'une équipe peut fournir sur une période : nombre de personnes × 5 jours × nombre de semaines, exprimé en jours-homme (j/h).
_À éviter_ : disponibilité, bande passante

**Charge planifiée** :
Les jours-homme réservés sur une période par les projets posés dans le vase, en comptant les cases entières qu'ils occupent (air compris), au prorata des semaines incluses dans la période.
_À éviter_ : capacité projetée, projeté, prévisionnel

**Capacité restante** :
La capacité d'une équipe sur une période, moins sa charge planifiée.
_À éviter_ : reste à faire, dispo

**Taux de remplissage** :
La charge planifiée divisée par la capacité, sur une même période.
_À éviter_ : taux d'occupation, charge (seule)

**Surcharge** :
Une capacité restante négative, qui ne peut venir que de briques en débordement.
_À éviter_ : dépassement, sur-allocation

**Air** :
La part des cases réservées par un projet que sa charge réelle ne remplit pas, due à l'arrondi aux cases entières.
_À éviter_ : marge, perte

**Charge en attente** :
La charge des projets du bac d'attente : ils n'ont pas de dates et n'entrent dans aucune charge planifiée.
_À éviter_ : backlog, reste

### Temps

**Fenêtre** :
Les semaines affichées, communes à tous les vases : 52 par défaut, extensibles, qui commencent par défaut à la semaine en cours et glissent avec elle.
_À éviter_ : horizon, vue

**Période** :
La tranche de semaines entières sur laquelle on calcule capacité, charge planifiée et capacité restante : 3 semaines, 3 mois, 6 mois, 12 mois ou personnalisée.
_À éviter_ : plage, intervalle
