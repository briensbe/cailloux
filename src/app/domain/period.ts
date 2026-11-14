/**
 * La période d'analyse et les indicateurs de capacité calculés dessus.
 * Voir GLOSSARY.md : capacité, charge planifiée, capacité restante, taux de remplissage, air.
 */
import { DAYS_PER_WEEK, footprint } from './capacity';
import { Occupancy, Rect } from './geometry';
import { Project } from './model';
import { toWindowRect } from './window';
import { addWeeks, currentMonday, mondayIso, weeksBetween } from './weeks';

/** Une tranche de semaines entières : du lundi `start` au dimanche de la dernière semaine. */
export interface Period {
  start: string;
  weeks: number;
}

export type PeriodPreset = '3s' | '3m' | '6m' | '12m';

export const PERIOD_PRESETS: readonly { id: PeriodPreset; label: string; weeks: number }[] = [
  { id: '3s', label: '3 semaines', weeks: 3 },
  { id: '3m', label: '3 mois', weeks: 13 },
  { id: '6m', label: '6 mois', weeks: 26 },
  { id: '12m', label: '12 mois', weeks: 52 },
];

/** Les périodes prédéfinies regardent devant : elles partent toujours de la semaine en cours. */
export function presetPeriod(preset: PeriodPreset, today = new Date()): Period {
  const weeks = PERIOD_PRESETS.find((p) => p.id === preset)!.weeks;
  return { start: currentMonday(today), weeks };
}

/** Période personnalisée : deux dates quelconques, dans n'importe quel ordre, ramenées à des semaines entières. */
export function customPeriod(fromIso: string, toIso: string): Period {
  const [a, b] = [mondayIso(fromIso), mondayIso(toIso)].sort();
  return { start: a, weeks: weeksBetween(a, b) + 1 };
}

/** Lundi de la semaine qui suit la période (borne exclue). */
export function periodEndExclusive(period: Period): string {
  return addWeeks(period.start, period.weeks);
}

/** Nombre de semaines d'une brique posée qui tombent dans la période. */
export function periodOverlap(p: Pick<Project, 'start' | 'weeks'>, period: Period): number {
  if (p.start === null) return 0;
  const from = weeksBetween(period.start, p.start);
  return Math.max(0, Math.min(from + p.weeks, period.weeks) - Math.max(from, 0));
}

export interface PeriodFigures {
  /** Effectif × 5 × semaines de la période (j/h). */
  capacity: number;
  /** Cases réservées par les briques posées, au prorata de la période, air compris (j/h). */
  planned: number;
  /** Part de la charge planifiée que les briques ne remplissent pas réellement (j/h). */
  air: number;
  /** Charge planifiée ÷ capacité (0 à 1, au-delà en cas de surcharge). */
  fill: number;
  /** Capacité − charge planifiée ; négative = surcharge. */
  remaining: number;
  /** Charge des projets du bac d'attente (j/h). */
  waiting: number;
  /** La charge en attente tiendrait-elle dans la capacité restante ? */
  waitingFits: boolean;
}

/**
 * Indicateurs d'une équipe sur une période.
 * On additionne les surfaces des briques plutôt que de compter les cases libres de la grille :
 * les briques ne se chevauchent jamais, et c'est ainsi que les lignes en débordement comptent aussi.
 */
export function periodFigures(teamSize: number, projects: readonly Project[], period: Period): PeriodFigures {
  let planned = 0;
  let air = 0;
  let waiting = 0;
  for (const p of projects) {
    if (p.start === null) {
      waiting += p.charge;
      continue;
    }
    const overlap = periodOverlap(p, period);
    planned += p.persons * overlap * DAYS_PER_WEEK;
    air += ((footprint(p) - Math.min(p.charge, footprint(p))) * overlap) / p.weeks;
  }
  const capacity = teamSize * period.weeks * DAYS_PER_WEEK;
  const remaining = capacity - planned;
  return {
    capacity,
    planned,
    air,
    fill: capacity ? planned / capacity : 0,
    remaining,
    waiting,
    waitingFits: waiting <= remaining,
  };
}

/** Somme des indicateurs de plusieurs équipes. */
export function sumFigures(list: readonly PeriodFigures[]): PeriodFigures {
  const sum = (key: 'capacity' | 'planned' | 'air' | 'waiting') => list.reduce((s, f) => s + f[key], 0);
  const capacity = sum('capacity');
  const planned = sum('planned');
  const remaining = capacity - planned;
  const waiting = sum('waiting');
  return {
    capacity,
    planned,
    air: sum('air'),
    fill: capacity ? planned / capacity : 0,
    remaining,
    waiting,
    waitingFits: waiting <= remaining,
  };
}

/** Carte d'occupation d'un vase limitée aux semaines de la période (pour l'eau et le plus gros caillou). */
export function periodOccupancy(teamSize: number, projects: readonly Project[], period: Period): Occupancy {
  const rects = projects.map((p) => toWindowRect(p, period.start)).filter((r): r is Rect => r !== null);
  return new Occupancy({ weeks: period.weeks, persons: teamSize }, rects);
}

/** La charge du bac commun face à la capacité restante de toutes les équipes. */
export interface CommonWaiting {
  /** Charge des projets sans équipe (j/h). */
  charge: number;
  /** Somme des capacités restantes des équipes sur la période (négative = surcharge). */
  remaining: number;
  /** Le bac commun tiendrait-il dans ce reste ? Estimation optimiste : ni la forme des projets ni le découpage de l'espace libre ne comptent. */
  fits: boolean;
}

export function commonWaiting(projects: readonly Project[], teams: readonly PeriodFigures[]): CommonWaiting {
  const charge = projects.filter((p) => p.teamId === null).reduce((s, p) => s + p.charge, 0);
  const remaining = sumFigures(teams).remaining;
  return { charge, remaining, fits: charge <= remaining };
}
