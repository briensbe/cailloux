# Signaler un débordement plutôt que déplacer les briques

Cailloux est un outil de simulation : quand une baisse d'effectif ou un raccourcissement de la fenêtre laisse des briques hors de la place disponible, on ne les envoie plus au bac d'attente, on ne les reforme pas et on ne bloque pas l'action. Les briques restent à leurs dates et à leurs lignes, et sont signalées (débordement, hors fenêtre) pour que l'utilisateur décide. Envoyer au bac faisait perdre les dates saisies ; bloquer empêchait de simuler un départ réel.

## Options écartées

- **Bloquer la réduction** tant qu'une brique occupe la ligne : impossible à tenir pour les projets passés réalisés avec l'effectif complet.
- **Reformer automatiquement** les briques (moins de personnes, plus de semaines) et les décaler : réorganisation spectaculaire, décidée à la place de l'utilisateur.

## Conséquences

- La capacité restante peut devenir négative (surcharge), mais uniquement à cause de briques en débordement : un redimensionnement reste, lui, bloqué par l'effectif.
- L'invariant « si ça ne tient pas, ça part au bac » ne vaut plus que pour le placement initial et le dépôt volontaire dans le bac.
