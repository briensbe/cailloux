# Briques ancrées sur des dates, fenêtre commune à toutes les équipes

Pour afficher 52 semaines glissantes, une brique retient sa semaine de début réelle au lieu d'un numéro de colonne relatif à une semaine de départ, et toutes les équipes partagent une même fenêtre de temps (52 semaines par défaut, extensible semaine par semaine) à la place de l'horizon propre à chaque équipe. Avec des colonnes relatives, faire glisser la fenêtre aurait déplacé tous les projets dans le calendrier.

## Conséquences

- Le format sauvegardé change : on passe à une nouvelle clé de stockage et l'on repart d'une démo réécrite, sans migration, car seules des données de démo existaient.
- Une brique peut exister hors de la fenêtre (avant ou après) : elle garde ses dates et est signalée au bord du vase au lieu d'être envoyée au bac d'attente.
