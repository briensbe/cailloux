import { PlanningState } from './model';
import { mondayOf, toIsoDate } from './weeks';

/**
 * Deux vases déjà bien remplis, pour raconter l'histoire dès l'ouverture :
 * « Galets » semble plein… mais il reste de la place pour l'eau, et un projet attend à côté.
 */
export function demoState(today = new Date()): PlanningState {
  return {
    startDate: toIsoDate(mondayOf(today)),
    teams: [
      { id: 'team-galets', name: 'Équipe Galets', size: 5, horizon: 12 },
      { id: 'team-silex', name: 'Équipe Silex', size: 3, horizon: 12 },
    ],
    projects: [
      { id: 'p-portail', teamId: 'team-galets', name: 'Refonte du portail client', charge: 120, weeks: 6, persons: 4, mode: 'free', color: 'terracotta', col: 0, row: 0 },
      { id: 'p-java', teamId: 'team-galets', name: 'Migration Java 21', charge: 50, weeks: 5, persons: 2, mode: 'fixed', color: 'slate', col: 6, row: 0 },
      { id: 'p-paiement', teamId: 'team-galets', name: 'API Paiement', charge: 60, weeks: 4, persons: 3, mode: 'free', color: 'lapis', col: 6, row: 2 },
      { id: 'p-dashboard', teamId: 'team-galets', name: 'Tableau de bord ventes', charge: 15, weeks: 3, persons: 1, mode: 'free', color: 'ochre', col: 0, row: 4 },
      { id: 'p-rgaa', teamId: 'team-galets', name: 'Accessibilité RGAA', charge: 13, weeks: 3, persons: 1, mode: 'fixed', color: 'jade', col: 3, row: 4 },
      { id: 'p-chatbot', teamId: 'team-galets', name: 'Chatbot support', charge: 40, weeks: 4, persons: 2, mode: 'fixed', color: 'quartz', col: null, row: null },
      { id: 'p-mobile', teamId: 'team-silex', name: 'App mobile v2', charge: 75, weeks: 5, persons: 3, mode: 'free', color: 'jade', col: 0, row: 0 },
      { id: 'p-search', teamId: 'team-silex', name: 'Moteur de recherche', charge: 40, weeks: 4, persons: 2, mode: 'fixed', color: 'basalt', col: 5, row: 0 },
      { id: 'p-sso', teamId: 'team-silex', name: 'SSO entreprise', charge: 10, weeks: 2, persons: 1, mode: 'free', color: 'sandstone', col: 5, row: 2 },
      { id: 'p-export', teamId: 'team-silex', name: 'Export comptable', charge: 8, weeks: 2, persons: 1, mode: 'fixed', color: 'ochre', col: 9, row: 0 },
    ],
  };
}
