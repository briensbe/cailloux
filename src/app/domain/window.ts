/**
 * La fenêtre de temps et le passage date ↔ colonne.
 *
 * Les briques sont ancrées sur des dates, mais la géométrie raisonne en colonnes :
 * on convertit à la frontière, et une colonne peut être négative (projet déjà commencé)
 * ou dépasser la fenêtre (projet au-delà du bord droit).
 */
import { Bounds, findFirstFit, Occupancy, Rect, Size } from './geometry';
import { PlanningWindow, Project } from './model';
import { currentMonday, weeksBetween } from './weeks';

/** Premier lundi affiché : celui de la semaine en cours quand la fenêtre est glissante. */
export function effectiveWindowStart(window: PlanningWindow, today = new Date()): string {
  return window.start ?? currentMonday(today);
}

/** La brique dans le repère de la fenêtre, ou `null` si elle attend dans le bac. */
export function toWindowRect(p: Pick<Project, 'start' | 'row' | 'weeks' | 'persons'>, windowStart: string): Rect | null {
  if (p.start === null || p.row === null) return null;
  return { col: weeksBetween(windowStart, p.start), row: p.row, weeks: p.weeks, persons: p.persons };
}

/** Où se trouve une brique entièrement hors de la fenêtre, ou `null` si elle y apparaît au moins en partie. */
export function outsideSide(r: Rect, windowWeeks: number): 'before' | 'after' | null {
  if (r.col + r.weeks <= 0) return 'before';
  if (r.col >= windowWeeks) return 'after';
  return null;
}

/** Une brique déborde quand elle occupe des lignes au-delà de l'effectif. */
export function isOverflowing(r: Rect, teamSize: number): boolean {
  return r.row + r.persons > teamSize;
}

/**
 * Le nombre minimal de semaines à ajouter à la fenêtre pour qu'un projet y trouve une place
 * à partir de `fromCol`, ou `null` s'il est plus haut que l'effectif.
 * `rects` inclut les briques au-delà du bord droit : en allongeant, on les retrouve.
 */
export function extensionToFit(size: Size, rects: readonly Rect[], bounds: Bounds, fromCol: number): number | null {
  if (size.persons > bounds.persons) return null;
  // Au-delà de la dernière brique, il y a forcément assez de colonnes vides.
  const lastEnd = Math.max(bounds.weeks, ...rects.map((r) => r.col + r.weeks));
  const limit = Math.max(lastEnd, fromCol) - bounds.weeks + size.weeks;
  for (let extra = 0; extra <= limit; extra++) {
    const occ = new Occupancy({ weeks: bounds.weeks + extra, persons: bounds.persons }, rects);
    if (findFirstFit(size, occ, fromCol)) return extra;
  }
  return null;
}
