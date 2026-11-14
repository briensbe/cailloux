import { LoadMode } from './model';

/** Une case de la grille = 1 personne pendant 1 semaine = 5 jours-homme. */
export const DAYS_PER_WEEK = 5;

/** Ce qui définit la forme d'une brique : largeur, hauteur et charge portée. */
export interface Dims {
  weeks: number;
  persons: number;
  charge: number;
}

export type Sizing = Dims & { mode: LoadMode };

// Sans cette marge, 40 / (2 × 5) peut valoir 4.000000001 et Math.ceil renverrait 5.
const EPSILON = 1e-9;

/** Nombre de semaines pour absorber une charge avec `persons` personnes en parallèle. */
export function weeksFor(charge: number, persons: number): number {
  return Math.max(1, Math.ceil(charge / (persons * DAYS_PER_WEEK) - EPSILON));
}

/** Nombre de personnes en parallèle pour absorber une charge en `weeks` semaines. */
export function personsFor(charge: number, weeks: number): number {
  return Math.max(1, Math.ceil(charge / (weeks * DAYS_PER_WEEK) - EPSILON));
}

/** Capacité (j/h) couverte par un rectangle de la grille. */
export function footprint(size: { weeks: number; persons: number }): number {
  return size.weeks * size.persons * DAYS_PER_WEEK;
}

/**
 * Part réellement occupée par la charge dans la brique.
 * Les cases sont entières : 13 j/h tiennent sur 3 semaines × 1 personne (15 j/h),
 * il reste donc 2 j/h « d'air » dans la brique.
 */
export function fillRatio(d: Dims): number {
  return Math.min(1, d.charge / footprint(d));
}

export function initialDims(charge: number, persons: number): Dims {
  return { weeks: weeksFor(charge, persons), persons, charge };
}

/** Étirer / rétrécir la brique dans le temps. */
export function withWeeks(s: Sizing, weeks: number, maxPersons: number): Dims {
  if (s.mode === 'fixed') {
    // Surface imposée : la largeur va de « toute l'équipe dessus » à « une seule personne ».
    const w = clamp(Math.round(weeks), weeksFor(s.charge, maxPersons), weeksFor(s.charge, 1));
    return { weeks: w, persons: personsFor(s.charge, w), charge: s.charge };
  }
  return freeResize(s, Math.max(1, Math.round(weeks)), s.persons);
}

/** Ajouter / retirer des personnes en parallèle. */
export function withPersons(s: Sizing, persons: number, maxPersons: number): Dims {
  const p = clamp(Math.round(persons), 1, maxPersons);
  if (s.mode === 'fixed') {
    return { weeks: weeksFor(s.charge, p), persons: p, charge: s.charge };
  }
  return freeResize(s, s.weeks, p);
}

/** Changer la charge : on garde le nombre de personnes, la durée suit (dans les deux modes). */
export function withCharge(s: Sizing, charge: number): Dims {
  const c = Math.max(0.5, charge);
  return { weeks: weeksFor(c, s.persons), persons: s.persons, charge: c };
}

/**
 * Mode libre : la charge devient la surface de la brique.
 * Tant que la forme ne change pas, on conserve la charge saisie (ex. 23 j/h sur 30 j/h de cases).
 */
export function freeResize(s: Dims, weeks: number, persons: number): Dims {
  if (weeks === s.weeks && persons === s.persons) return { weeks, persons, charge: s.charge };
  return { weeks, persons, charge: footprint({ weeks, persons }) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Forme d'un projet qui entre dans un vase de `teamSize` personnes (spec `bac-commun`).
 * S'il est trop haut, on le ramène à l'effectif en gardant sa charge : la durée s'allonge.
 * On passe par `initialDims` et non par `withPersons` : en mode libre, `withPersons` ferait
 * suivre la charge à la surface, donc la ferait baisser.
 */
export function fitToTeam(d: Dims, teamSize: number): Dims {
  if (d.persons <= teamSize) return { weeks: d.weeks, persons: d.persons, charge: d.charge };
  return initialDims(d.charge, Math.max(1, teamSize));
}
