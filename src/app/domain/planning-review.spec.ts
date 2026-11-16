import { PlanningState, Project, Team } from './model';
import { ExportedProject, PlanningExport } from './planning-export';
import {
  applyPlanning,
  PlanAction,
  PlanningChoices,
  reviewPlanning,
  targetOf,
} from './planning-review';

const TODAY = '2026-11-16';

function exported(
  name: string,
  team: string | null,
  load: Record<string, number>,
  extra: Partial<ExportedProject> = {},
): ExportedProject {
  return { name, team, load, remaining: null, color: null, meta: { Statut: 'En cours' }, ...extra };
}

function project(name: string, extra: Partial<Project> = {}): Project {
  return {
    id: `p-${name}`,
    teamId: null,
    name,
    charge: 5,
    weeks: 1,
    persons: 1,
    mode: 'free',
    color: 'jade',
    start: null,
    row: null,
    ...extra,
  };
}

function state(
  projects: Project[],
  teams: Team[] = [{ id: 't-art', name: 'Artémis', size: 2 }],
  weeks = 52,
): PlanningState {
  return { window: { start: null, weeks }, teams, projects };
}

function choices(
  actions: [string, PlanAction][] = [],
  sizes: [string, number][] = [],
): PlanningChoices {
  return { actions: new Map(actions), teamSizes: new Map(sizes) };
}

const exp = (...projects: ExportedProject[]): PlanningExport => ({
  teams: [...new Set(projects.map((p) => p.team).filter((t): t is string => t !== null))],
  projects,
});

/** Une semaine de charge par lundi, de `from` sur `count` semaines. */
function weekly(from: string, count: number, days = 1): Record<string, number> {
  const load: Record<string, number> = {};
  const d = new Date(`${from}T00:00:00Z`);
  for (let i = 0; i < count; i++) {
    load[d.toISOString().slice(0, 10)] = days;
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return load;
}

let seq = 0;
const ids = (prefix: string) => `${prefix}-${++seq}`;

describe('planning-review', () => {
  beforeEach(() => (seq = 0));

  describe('targetOf', () => {
    it('ne garde que la partie à venir (C Bourse - Offre ACCESS)', () => {
      const load = {
        ...weekly('2026-10-26', 3, 0.5),
        ...weekly('2026-11-16', 5, 1),
        ...weekly('2026-12-21', 2, 0.5),
      };
      expect(targetOf({ load }, TODAY)).toMatchObject({
        start: '2026-11-16',
        weeks: 7,
        persons: 1,
        charge: 6,
      });
    });

    it('garde toute la durée de semaines éparses (Maintenance)', () => {
      const load = { ...weekly('2026-10-26', 3, 1), '2026-12-07': 0.3, '2027-01-04': 0.3 };
      expect(targetOf({ load }, TODAY)).toMatchObject({
        start: '2026-12-07',
        weeks: 5,
        persons: 1,
        charge: 0.6,
      });
    });

    it("n'a pas de cible quand tout est passé", () => {
      expect(targetOf({ load: weekly('2026-10-26', 3) }, TODAY)).toBeNull();
    });
  });

  describe('états et actions', () => {
    it('à poser : dans le bac commun, posé à sa date', () => {
      const r = reviewPlanning(
        exp(exported('Offre crypto', 'Artémis', weekly('2026-11-30', 3))),
        state([project('Offre crypto')]),
        TODAY,
        choices(),
      );
      expect(r.lines[0]).toMatchObject({
        status: 'toPlace',
        action: 'place',
        outcome: { kind: 'placed', row: 0 },
      });
    });

    it('à jour malgré une autre ligne', () => {
      const p = project('Tracking', {
        teamId: 't-art',
        start: '2026-11-30',
        row: 1,
        weeks: 3,
        charge: 3,
      });
      const r = reviewPlanning(
        exp(exported('Tracking', 'Artémis', weekly('2026-11-30', 3))),
        state([p]),
        TODAY,
        choices(),
      );
      expect(r.lines[0]).toMatchObject({ status: 'upToDate', actions: ['none'] });
    });

    it('écart de date : laissé par défaut, aligné sur demande', () => {
      const p = project('ECO294', {
        teamId: 't-art',
        start: '2027-01-11',
        row: 0,
        weeks: 3,
        charge: 3,
      });
      const e = exp(exported('ECO294', 'Artémis', weekly('2026-12-07', 3)));
      const kept = reviewPlanning(e, state([p]), TODAY, choices());
      expect(kept.lines[0]).toMatchObject({
        status: 'drift',
        action: 'none',
        drift: { team: false, start: true, weeks: false, charge: false },
      });

      const aligned = reviewPlanning(e, state([p]), TODAY, choices([['eco294', 'align']]));
      expect(aligned.lines[0].outcome).toEqual({ kind: 'placed', row: 0 });
      const after = applyPlanning(state([p]), aligned, ids).projects[0];
      expect(after).toMatchObject({ start: '2026-12-07', row: 0, weeks: 3, charge: 3 });
    });

    it("dans le bac d'une autre équipe : en écart", () => {
      const teams = [
        { id: 't-art', name: 'Artémis', size: 2 },
        { id: 't-aur', name: 'Aurora', size: 2 },
      ];
      const r = reviewPlanning(
        exp(exported('X', 'Artémis', weekly('2026-12-07', 2))),
        state([project('X', { teamId: 't-aur' })], teams),
        TODAY,
        choices(),
      );
      expect(r.lines[0]).toMatchObject({ status: 'drift', drift: { team: true } });
    });

    it('sans suite : toutes les semaines sont passées', () => {
      const r = reviewPlanning(
        exp(exported('Vieux', 'Artémis', weekly('2026-10-26', 2))),
        state([]),
        TODAY,
        choices(),
      );
      expect(r.lines[0]).toMatchObject({ status: 'ended', actions: ['none'] });
    });

    it("non planifié : du bac commun au bac de l'équipe, avec le restant pour charge", () => {
      const s = state([project('PIP', { meta: { 'Code Projet': 'X1' } })]);
      const r = reviewPlanning(
        exp(exported('PIP', 'Artémis', {}, { remaining: 61 })),
        s,
        TODAY,
        choices(),
      );
      expect(r.lines[0]).toMatchObject({
        status: 'unplanned',
        action: 'toTray',
        outcome: { kind: 'tray' },
      });
      expect(applyPlanning(s, r, ids).projects[0]).toMatchObject({
        teamId: 't-art',
        start: null,
        row: null,
        charge: 61,
        persons: 1,
      });
    });

    it('non planifié déjà posé : laissé', () => {
      const p = project('Run', { teamId: 't-art', start: '2026-11-16', row: 0 });
      const r = reviewPlanning(exp(exported('Run', 'Artémis', {})), state([p]), TODAY, choices());
      expect(r.lines[0]).toMatchObject({ status: 'unplanned', actions: ['none'] });
    });

    it('nouveau : créé et posé, avec la pierre de sa couleur', () => {
      const s = state([]);
      const r = reviewPlanning(
        exp(exported('Neuf', 'Artémis', weekly('2026-12-07', 2), { color: '#3b82f6' })),
        s,
        TODAY,
        choices(),
      );
      expect(r.lines[0]).toMatchObject({ status: 'new', action: 'place' });
      const created = applyPlanning(s, r, ids).projects[0];
      expect(created).toMatchObject({
        id: 'p-1',
        name: 'Neuf',
        teamId: 't-art',
        start: '2026-12-07',
        row: 0,
        weeks: 2,
        charge: 2,
        mode: 'free',
        color: 'lapis',
      });
    });
  });

  describe('équipes', () => {
    it('rattache une équipe existante à la casse près, sans demander d’effectif', () => {
      const r = reviewPlanning(
        exp(exported('A', 'artémis', weekly('2026-12-07', 1))),
        state([]),
        TODAY,
        choices(),
      );
      expect(r.teams[0]).toMatchObject({ existing: { id: 't-art' }, size: 2 });
      expect(r.ready).toBe(true);
    });

    it("attend l'effectif d'une équipe à créer, puis la crée", () => {
      const e = exp(exported('A', 'Aurora', weekly('2026-12-07', 1)));
      const waiting = reviewPlanning(e, state([]), TODAY, choices());
      expect(waiting.missingSizes).toEqual(['Aurora']);
      expect(waiting.ready).toBe(false);
      expect(waiting.lines[0].outcome).toEqual({ kind: 'pending' });

      const r = reviewPlanning(e, state([]), TODAY, choices([], [['aurora', 3]]));
      const after = applyPlanning(state([]), r, ids);
      expect(after.teams.at(-1)).toEqual({ id: 'team-1', name: 'Aurora', size: 3 });
      expect(after.projects[0]).toMatchObject({ teamId: 'team-1', row: 0 });
    });

    it("signale les projets d'une équipe absents de l'export", () => {
      const r = reviewPlanning(
        exp(exported('A', 'Artémis', {})),
        state([project('Ancien', { teamId: 't-art' })]),
        TODAY,
        choices(),
      );
      expect(r.teams[0].absent.map((p) => p.name)).toEqual(['Ancien']);
    });
  });

  describe('pose à date exacte', () => {
    const busy = (name: string, row: number, start = '2026-11-16', weeks = 7) =>
      project(name, { teamId: 't-art', start, row, weeks, charge: weeks });

    it('prend la ligne suivante quand la première est occupée', () => {
      const r = reviewPlanning(
        exp(exported('B', 'Artémis', weekly('2026-11-30', 7))),
        state([busy('A', 0)]),
        TODAY,
        choices(),
      );
      expect(r.lines[0].outcome).toEqual({ kind: 'placed', row: 1 });
    });

    it("va au bac de l'équipe quand aucune ligne n'est libre", () => {
      const s = state([busy('A', 0), busy('B', 1)]);
      const r = reviewPlanning(
        exp(exported('C', 'Artémis', weekly('2026-12-07', 2))),
        s,
        TODAY,
        choices(),
      );
      expect(r.lines[0].outcome).toEqual({ kind: 'tray' });
      expect(applyPlanning(s, r, ids).projects.at(-1)).toMatchObject({
        teamId: 't-art',
        start: null,
        row: null,
        weeks: 2,
      });
    });

    it("laisse au bac de l'équipe, sans compter d'action, un projet qui y est déjà et ne trouve toujours pas de place", () => {
      const s = state([busy('A', 0), busy('B', 1), project('C', { teamId: 't-art' })]);
      const r = reviewPlanning(
        exp(exported('C', 'Artémis', weekly('2026-12-07', 2))),
        s,
        TODAY,
        choices(),
      );
      expect(r.lines[0]).toMatchObject({ status: 'toPlace', outcome: { kind: 'unchanged' } });
      expect(r.summary.actions).toBe(0);
    });

    it('agrandit la fenêtre juste assez', () => {
      const s = state([], undefined, 52);
      // 50 semaines après la semaine en cours, sur 4 semaines : 2 de trop.
      const r = reviewPlanning(
        exp(exported('Loin', 'Artémis', weekly('2027-11-01', 4))),
        s,
        TODAY,
        choices(),
      );
      expect(r.extraWeeks).toBe(2);
      expect(applyPlanning(s, r, ids).window.weeks).toBe(54);
    });

    it('accepte une colonne négative quand la fenêtre est décalée vers le futur', () => {
      const s: PlanningState = { ...state([]), window: { start: '2026-12-07', weeks: 52 } };
      const r = reviewPlanning(
        exp(exported('Tôt', 'Artémis', weekly('2026-11-16', 6))),
        s,
        TODAY,
        choices(),
      );
      expect(r.lines[0].outcome).toEqual({ kind: 'placed', row: 0 });
    });

    it('laisse en place un alignement sans place libre', () => {
      const moving = busy('M', 0, '2027-03-01', 2);
      const s = state([
        moving,
        busy('A', 1, '2026-11-16'),
        project('B2', { teamId: 't-art', start: '2026-11-16', row: 0, weeks: 7, charge: 7 }),
      ]);
      // Ligne 0 occupée par B2 et ligne 1 par A sur toute la période visée.
      const r = reviewPlanning(
        exp(exported('M', 'Artémis', weekly('2026-11-23', 2))),
        s,
        TODAY,
        choices([['m', 'align']]),
      );
      expect(r.lines[0].outcome).toEqual({ kind: 'unchanged' });
      expect(r.summary.actions).toBe(0);
      expect(applyPlanning(s, r, ids)).toBe(s);
    });
  });

  describe('applyPlanning', () => {
    it("complète les métadonnées sans modifier l'état d'entrée", () => {
      const s = state([
        project('Offre crypto', { meta: { 'Code Projet': '2026_002', Description: 'Crypto' } }),
      ]);
      const before = structuredClone(s);
      const e = exp(
        exported('Offre crypto', 'Artémis', weekly('2026-12-07', 2), {
          meta: { 'Code Projet': '2026_002b', Chiffres: 'restant 3' },
        }),
      );
      const after = applyPlanning(s, reviewPlanning(e, s, TODAY, choices()), ids);
      expect(s).toEqual(before);
      expect(after.projects[0].meta).toEqual({
        'Code Projet': '2026_002b',
        Description: 'Crypto',
        Chiffres: 'restant 3',
        'Semaines planifiées': '07/12 : 1 · 14/12 : 1 (2 semaines, 2 j)',
      });
      expect(after.teams).toEqual(s.teams);
    });

    it('produit exactement les issues de la revue', () => {
      const s = state(
        [project('A'), project('B'), project('C')],
        [{ id: 't-art', name: 'Artémis', size: 1 }],
      );
      const e = exp(
        exported('A', 'Artémis', weekly('2026-12-07', 2)),
        exported('B', 'Artémis', weekly('2026-12-14', 2)),
        exported('C', 'Artémis', weekly('2027-01-04', 2)),
      );
      const r = reviewPlanning(e, s, TODAY, choices());
      expect(r.lines.map((l) => l.outcome.kind)).toEqual(['placed', 'tray', 'placed']);
      const after = applyPlanning(s, r, ids);
      expect(after.projects.map((p) => [p.name, p.start, p.row])).toEqual([
        ['A', '2026-12-07', 0],
        ['B', null, null],
        ['C', '2027-01-04', 0],
      ]);
      expect(r.summary).toMatchObject({ placed: 2, tray: 1, actions: 3, created: 0 });
    });
  });
});
