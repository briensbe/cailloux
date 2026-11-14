import { DEFAULT_WINDOW_WEEKS, PlanningState, Project } from './model';
import { addWeeks, currentMonday } from './weeks';

/**
 * Deux vases déjà bien remplis, pour raconter l'histoire dès l'ouverture :
 * « Galets » semble plein… mais il reste de la place pour l'eau, deux projets ont déjà
 * commencé, un projet attend à côté, et « Silex » a un projet au-delà de la fenêtre.
 */
export function demoState(today = new Date()): PlanningState {
  const monday = currentMonday(today);
  // `in` = décalage en semaines par rapport à la semaine en cours (négatif = déjà commencé).
  const brick = (p: Omit<Project, 'start'> & { in: number | null }): Project => {
    const { in: offset, ...rest } = p;
    return { ...rest, start: offset === null ? null : addWeeks(monday, offset) };
  };
  return {
    window: { start: null, weeks: DEFAULT_WINDOW_WEEKS },
    teams: [
      { id: 'team-galets', name: 'Équipe Galets', size: 5 },
      { id: 'team-silex', name: 'Équipe Silex', size: 3 },
    ],
    projects: [
      brick({ id: 'p-portail', teamId: 'team-galets', name: 'Refonte du portail client', charge: 120, weeks: 6, persons: 4, mode: 'free', color: 'terracotta', in: -2, row: 0 }),
      brick({ id: 'p-dashboard', teamId: 'team-galets', name: 'Tableau de bord ventes', charge: 15, weeks: 3, persons: 1, mode: 'free', color: 'ochre', in: -2, row: 4 }),
      brick({ id: 'p-rgaa', teamId: 'team-galets', name: 'Accessibilité RGAA', charge: 13, weeks: 3, persons: 1, mode: 'fixed', color: 'jade', in: 1, row: 4 }),
      brick({ id: 'p-java', teamId: 'team-galets', name: 'Migration Java 21', charge: 50, weeks: 5, persons: 2, mode: 'fixed', color: 'slate', in: 4, row: 0 }),
      brick({ id: 'p-paiement', teamId: 'team-galets', name: 'API Paiement', charge: 60, weeks: 4, persons: 3, mode: 'free', color: 'lapis', in: 4, row: 2 }),
      brick({ id: 'p-terrain', teamId: 'team-galets', name: 'Appli mobile terrain', charge: 160, weeks: 8, persons: 4, mode: 'free', color: 'basalt', in: 10, row: 0 }),
      brick({ id: 'p-datalake', teamId: 'team-galets', name: 'Data lake', charge: 90, weeks: 6, persons: 3, mode: 'fixed', color: 'sandstone', in: 20, row: 1 }),
      brick({ id: 'p-chatbot', teamId: 'team-galets', name: 'Chatbot support', charge: 40, weeks: 4, persons: 2, mode: 'fixed', color: 'quartz', in: null, row: null }),
      brick({ id: 'p-mobile', teamId: 'team-silex', name: 'App mobile v2', charge: 75, weeks: 5, persons: 3, mode: 'free', color: 'jade', in: 0, row: 0 }),
      brick({ id: 'p-search', teamId: 'team-silex', name: 'Moteur de recherche', charge: 40, weeks: 4, persons: 2, mode: 'fixed', color: 'basalt', in: 5, row: 0 }),
      brick({ id: 'p-sso', teamId: 'team-silex', name: 'SSO entreprise', charge: 10, weeks: 2, persons: 1, mode: 'free', color: 'sandstone', in: 5, row: 2 }),
      brick({ id: 'p-export', teamId: 'team-silex', name: 'Export comptable', charge: 8, weeks: 2, persons: 1, mode: 'fixed', color: 'ochre', in: 9, row: 0 }),
      brick({ id: 'p-fournisseurs', teamId: 'team-silex', name: 'Portail fournisseurs', charge: 45, weeks: 3, persons: 3, mode: 'free', color: 'lapis', in: 14, row: 0 }),
      brick({ id: 'p-sirh', teamId: 'team-silex', name: 'Refonte SIRH', charge: 60, weeks: 4, persons: 3, mode: 'free', color: 'terracotta', in: 56, row: 0 }),
    ],
  };
}
