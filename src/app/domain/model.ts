/**
 * Modèle métier de « Cailloux ».
 *
 * Chaque équipe possède un vase : une grille dont
 *  - l'axe X compte les semaines de la fenêtre, commune à tous les vases,
 *  - l'axe Y compte les personnes de l'équipe (ligne 0 = fond du vase).
 * Un projet est une brique rectangulaire ancrée sur une semaine réelle :
 * largeur = semaines, hauteur = personnes en parallèle, surface = charge.
 */

/**
 * - `free`  : on étire librement la brique, c'est la charge qui suit (largeur × hauteur).
 * - `fixed` : la charge est figée ; étirer dans le temps réduit le nombre de personnes, et inversement.
 */
export type LoadMode = 'free' | 'fixed';

export const STONE_COLORS = [
  'terracotta',
  'ochre',
  'jade',
  'lapis',
  'slate',
  'quartz',
  'basalt',
  'sandstone',
] as const;

export type StoneColor = (typeof STONE_COLORS)[number];

export const STONES: Record<StoneColor, { label: string; base: string; ink: string }> = {
  terracotta: { label: 'Terre cuite', base: '#c8643b', ink: '#fff6ee' },
  ochre: { label: 'Ocre', base: '#d9a441', ink: '#2b1d05' },
  jade: { label: 'Jade', base: '#4f9573', ink: '#f1fff7' },
  lapis: { label: 'Lapis', base: '#3d5a99', ink: '#f1f4ff' },
  slate: { label: 'Ardoise', base: '#56687a', ink: '#f3f7fb' },
  quartz: { label: 'Quartz rose', base: '#d98a8a', ink: '#2e0f12' },
  basalt: { label: 'Basalte', base: '#3a3b3f', ink: '#f4f4f4' },
  sandstone: { label: 'Grès', base: '#c9ae84', ink: '#2c2210' },
};

/** Effectif maximal d'une équipe ; borne aussi les personnes d'un projet sans équipe. */
export const MAX_TEAM_SIZE = 30;

export interface Team {
  id: string;
  name: string;
  /** Effectif : la hauteur du vase. */
  size: number;
}

export interface Project {
  id: string;
  /**
   * Équipe du projet, ou `null` pour un projet du bac commun, qu'aucune équipe n'a encore pris
   * (ADR 0003). Un projet sans équipe a toujours `start = row = null`.
   */
  teamId: string | null;
  name: string;
  /** Charge en jours-homme (j/h). */
  charge: number;
  weeks: number;
  persons: number;
  mode: LoadMode;
  color: StoneColor;
  /** Lundi de la semaine de début (ISO `yyyy-mm-dd`). `null` = la brique attend dans le bac. */
  start: string | null;
  /** Première ligne occupée en partant du fond du vase. `null` = dans le bac. */
  row: number | null;
}

export const DEFAULT_WINDOW_WEEKS = 52;

/** Les semaines affichées, communes à tous les vases. */
export interface PlanningWindow {
  /** Lundi de la première semaine, ou `null` pour une fenêtre glissante qui suit la semaine en cours. */
  start: string | null;
  weeks: number;
}

export interface PlanningState {
  window: PlanningWindow;
  teams: Team[];
  projects: Project[];
}

/** Le vocabulaire de la métaphore, selon la taille du projet. */
export function stoneKind(charge: number): string {
  if (charge >= 60) return 'Gros caillou';
  if (charge >= 20) return 'Caillou';
  if (charge >= 5) return 'Gravier';
  return 'Sable';
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
