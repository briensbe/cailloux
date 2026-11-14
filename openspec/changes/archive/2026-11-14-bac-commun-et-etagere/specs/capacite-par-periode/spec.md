# Spec Delta

## MODIFIED Requirements

### Requirement: Charge en attente

Pour chaque équipe, le système MUST afficher la charge totale des projets de son bac d'attente, et indiquer si cette charge tiendrait dans la capacité restante de la période. Le dock du bac commun MUST afficher la charge totale du bac commun et indiquer si elle tiendrait dans la somme des capacités restantes de toutes les équipes sur la période. L'en-tête MUST afficher la charge en attente des deux sortes de bac réunies, en précisant la part du bac commun.

#### Scenario: Ne tiendrait pas
- **GIVEN** une capacité restante de 40 j/h et un bac contenant 60 j/h de projets
- **THEN** le vase affiche 60 j/h en attente avec l'indication « ne tiendrait pas »

#### Scenario: Bac commun face à toutes les équipes
- **GIVEN** deux équipes avec 115 j/h et 75 j/h restants sur la période, et un bac commun de 337 j/h
- **THEN** le dock affiche 337 j/h avec l'indication « ne tiendrait pas » face aux 190 j/h restants

#### Scenario: Total de l'en-tête
- **GIVEN** 40 j/h dans les bacs d'équipe et 337 j/h dans le bac commun
- **THEN** l'en-tête affiche 377 j/h en attente, dont 337 j/h non attribués
