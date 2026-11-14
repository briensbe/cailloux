# Proposition

## Pourquoi

Un vase ne montre aujourd'hui que l'horizon propre à son équipe (12 semaines par défaut), et la seule capacité affichée porte sur tout cet horizon. On ne peut ni voir l'année d'un coup, ni répondre à la question d'un demandeur : « combien reste-t-il de capacité au prochain trimestre, ou entre telle et telle date ? ». Par ailleurs, réduire une équipe ou un horizon envoie des briques au bac d'attente et fait perdre les dates saisies.

## Ce qui change

- **BREAKING** Les briques sont ancrées sur une semaine de début réelle, et non plus sur un numéro de colonne relatif à la semaine de départ. Le format sauvegardé change : nouvelle clé de stockage, démo réécrite, pas de migration (cf. ADR 0001).
- **BREAKING** L'horizon propre à chaque équipe disparaît au profit d'une **fenêtre** commune à tous les vases : 52 semaines par défaut, ajustable semaine par semaine sans minimum, qui démarre à la semaine en cours et glisse avec elle. On peut la décaler à la main (y compris vers le passé) et revenir à aujourd'hui. Sa longueur fait partie du planning (sauvegardée, annulable).
- Un mode « tout voir » fait tenir la fenêtre dans la largeur de l'écran ; le zoom existant reste disponible.
- Les briques en dehors de la fenêtre gardent leurs dates : coupées au bord avec un signe de continuation, ou signalées par une pastille au bord du vase et un avertissement global, avec un clic pour les ramener à l'écran.
- Un sélecteur de **période** (3 semaines, 3 mois, 6 mois, 12 mois, personnalisée ; 3 mois par défaut) fixe la tranche de semaines entières sur laquelle on calcule, par équipe et en total : capacité, charge planifiée (dont l'air), taux de remplissage, capacité restante, et charge en attente avec un indicateur « tiendrait / ne tiendrait pas ».
- « Le vase est-il plein ? » porte sur la période : l'eau ne monte que dans ses semaines, et le plus gros caillou possible est cherché dans la période.
- Un nouveau projet est placé à la première place libre de la fenêtre, à partir de la semaine en cours ; s'il ne tient pas, la fenêtre « Nouveau caillou » propose d'agrandir la fenêtre juste assez pour le poser.
- « Tasser » fait glisser les briques vers la semaine en cours, jamais avant ; les briques qui commencent avant ne sont pas déplacées par le tassement, mais restent déplaçables à la main.
- **BREAKING** Réduire l'effectif d'une équipe ou raccourcir la fenêtre n'envoie plus rien au bac : les briques restent en place et sont signalées (débordement, hors fenêtre). La surcharge (capacité restante négative) devient possible, uniquement à cause de briques en débordement (cf. ADR 0002).

## Capacités

### Nouvelles capacités

- `fenetre-de-temps` : la fenêtre de semaines commune aux vases, l'ancrage des briques sur des dates, le décalage, l'allongement, l'affichage et le signalement des briques hors fenêtre.
- `capacite-par-periode` : la période d'analyse et les indicateurs calculés dessus (capacité, charge planifiée, air, taux de remplissage, capacité restante, charge en attente), y compris « Le vase est-il plein ? ».
- `debordement` : le traitement des briques qui ne tiennent plus après une baisse d'effectif, sans perte de saisie, et la surcharge qui en découle.

### Capacités modifiées

_Aucune : aucune spec n'existe encore dans le projet._

## Impact

- **Domaine** (`src/app/domain`) : modèle `Project` et `Team` (date de début, suppression de l'horizon), `PlanningState` (fenêtre), nouveaux calculs de période dans `capacity.ts`, géométrie exprimée par rapport à la fenêtre, `compact` borné à la semaine en cours, démo réécrite. Nouveaux tests unitaires.
- **État** (`src/app/state`) : `PlanningStore` (fenêtre, période, réduction d'effectif sans bac, agrandissement de fenêtre), nouvelle clé de stockage, `ViewService` (période sélectionnée, mode « tout voir »), `DragService` (conversion pixel ↔ date).
- **Interface** (`src/app/ui`, `app.html`) : en-tête et barre d'outils (fenêtre, période, avertissements), vase (bords coupés, pastilles, débordement, eau sur la période), brique (bords coupés, rendu compact), fenêtre « Nouveau caillou » (agrandir la fenêtre).
- **Documentation** : invariants de `CLAUDE.md` (le bac n'est plus la destination des briques qui ne tiennent plus), README.
- Les données sauvegardées sous l'ancienne clé sont ignorées : les utilisateurs repartent de la démo.
