import { fitToTeam, initialDims, personsFor } from './capacity';
import { canOccupy, Rect } from './geometry';
import { MAX_TEAM_SIZE, PlanningState, Project, STONE_COLORS, Team } from './model';
import { nameKey } from './names';
import { describeLoad, ExportedProject, PlanningExport } from './planning-export';
import { nearestStone } from './stones';
import { toWindowRect } from './window';
import { weeksBetween } from './weeks';

/**
 * Comparaison d'un export de planification avec le planning, et application du résultat.
 *
 * Même principe que l'import Excel (`reviewImport`) : le dialogue ne garde que les choix de
 * l'utilisateur, et `reviewPlanning` recalcule tout, y compris la **simulation des poses**.
 * `applyPlanning` produit ensuite le nouvel état d'après cette revue : ce que l'aperçu montre
 * est exactement ce qui sera appliqué.
 */

/** Écart de charge en dessous duquel deux charges sont égales (les jours décimaux traînent des erreurs d'arrondi). */
export const CHARGE_TOLERANCE = 0.1;
/** Charge d'un projet envoyé au bac d'équipe sans « restant » connu ni charge précédente. */
export const DEFAULT_TRAY_CHARGE = 5;

/** La brique qu'un projet devrait être d'après l'export : sa partie à venir, sur toute sa durée. */
export interface Target {
  /** Première semaine planifiée à venir (lundi ISO). */
  start: string;
  weeks: number;
  /** Une personne, sauf si une semaine porte plus de 5 jours (cas hors périmètre, gardé cohérent). */
  persons: number;
  /** Total des jours planifiés à venir. */
  charge: number;
  /** La partie à venir, semaine par semaine. */
  load: Record<string, number>;
}

/**
 * - `new` : absent de Cailloux ;
 * - `toPlace` : dans le bac commun ou le bac de son équipe ;
 * - `upToDate` : posé conforme à sa cible ;
 * - `drift` : posé autrement, ou dans le bac d'une autre équipe ;
 * - `unplanned` : aucune semaine planifiée ;
 * - `ended` : toutes ses semaines planifiées sont passées.
 */
export type LineStatus = 'new' | 'toPlace' | 'upToDate' | 'drift' | 'unplanned' | 'ended';

/** `place` : poser à sa date · `toTray` : bac de son équipe · `align` : aligner sur la cible · `none` : ne rien faire. */
export type PlanAction = 'place' | 'toTray' | 'align' | 'none';

/** Ce qui arrivera vraiment au projet, d'après la simulation. */
export type Outcome =
  | { kind: 'placed'; row: number }
  /** Au bac de son équipe : demandé, ou pose sans place libre. */
  | { kind: 'tray' }
  /** Pas de place libre : la brique reste où elle est (alignement, ou projet déjà au bac de son équipe). */
  | { kind: 'unchanged' }
  | { kind: 'none' }
  /** L'équipe est à créer et son effectif n'est pas encore saisi. */
  | { kind: 'pending' };

export interface Drift {
  team: boolean;
  start: boolean;
  weeks: boolean;
  charge: boolean;
}

export interface PlanLine {
  key: string;
  name: string;
  exported: ExportedProject;
  /** `nameKey` de l'équipe du projet dans l'export, ou `null` s'il n'en a pas. */
  teamKey: string | null;
  existing: Project | null;
  target: Target | null;
  status: LineStatus;
  /** Actions possibles, la première étant l'action par défaut. */
  actions: readonly PlanAction[];
  action: PlanAction;
  /** Ce qui diffère de la cible, pour un projet en écart. */
  drift: Drift | null;
  outcome: Outcome;
}

export interface TeamPlan {
  key: string;
  name: string;
  existing: Team | null;
  /** Effectif : celui de l'équipe existante, ou celui saisi pour une équipe à créer. */
  size: number | null;
  /** Au moins un projet de l'équipe a une action : une équipe à créer le sera. */
  needed: boolean;
  lines: PlanLine[];
  /** Projets de l'équipe existante absents de l'export : seulement signalés. */
  absent: Project[];
}

export interface PlanningChoices {
  /** Effectif saisi pour une équipe à créer, par `nameKey` de son nom. */
  teamSizes: ReadonlyMap<string, number>;
  /** Action choisie pour un projet, par `nameKey` de son nom, quand elle diffère du défaut. */
  actions: ReadonlyMap<string, PlanAction>;
}

export interface PlanningSummary {
  created: number;
  placed: number;
  aligned: number;
  tray: number;
  /** Poses ou alignements sans place libre, qui laissent le projet où il est. */
  unchanged: number;
  teamsCreated: number;
  /** Nombre de projets réellement modifiés ou créés. */
  actions: number;
}

export interface PlanningReview {
  lines: PlanLine[];
  teams: TeamPlan[];
  windowStart: string;
  /** Semaines à ajouter à la fenêtre pour que les cibles à poser y tiennent. */
  extraWeeks: number;
  /** Noms des équipes à créer dont l'effectif manque : tant qu'il y en a, on ne peut pas appliquer. */
  missingSizes: string[];
  /** Noms portés par plusieurs projets de Cailloux : rapprochés du premier trouvé. */
  ambiguous: string[];
  summary: PlanningSummary;
  ready: boolean;
}

/**
 * La cible d'un projet : ses semaines planifiées à partir de `today` (lundi de la semaine en cours,
 * comprise), de la première à la dernière, et leur total. `null` s'il ne reste rien à venir.
 */
export function targetOf(project: Pick<ExportedProject, 'load'>, today: string): Target | null {
  const weeks = Object.keys(project.load)
    .filter((w) => w >= today)
    .sort();
  if (weeks.length === 0) return null;
  const load: Record<string, number> = {};
  for (const w of weeks) load[w] = project.load[w];
  const start = weeks[0];
  const span = weeksBetween(start, weeks[weeks.length - 1]) + 1;
  const charge = Math.round(weeks.reduce((sum, w) => sum + load[w], 0) * 100) / 100;
  return { start, weeks: span, persons: personsFor(charge, span), charge, load };
}

export function reviewPlanning(
  exp: PlanningExport,
  state: PlanningState,
  today: string,
  choices: PlanningChoices,
): PlanningReview {
  const windowStart = state.window.start ?? today;
  const teamById = new Map(state.teams.map((t) => [t.id, t]));
  const teamByKey = new Map(state.teams.map((t) => [nameKey(t.name), t]));

  // Les projets de Cailloux par nom ; un nom porté deux fois est rapproché du premier, et signalé.
  const byKey = new Map<string, Project>();
  const ambiguous = new Set<string>();
  for (const p of state.projects) {
    const k = nameKey(p.name);
    if (byKey.has(k)) ambiguous.add(byKey.get(k)!.name);
    else byKey.set(k, p);
  }
  const exportedKeys = new Set(exp.projects.map((p) => nameKey(p.name)));

  const lines = exp.projects.map((exported) => {
    const key = nameKey(exported.name);
    const teamKey = exported.team === null ? null : nameKey(exported.team);
    return classify(exported, key, teamKey, byKey.get(key) ?? null, today, teamById, choices);
  });

  // Les équipes, dans l'ordre de l'export, et un groupe pour les projets sans équipe.
  const teams: TeamPlan[] = exp.teams.map((name) => {
    const key = nameKey(name);
    const existing = teamByKey.get(key) ?? null;
    const lineOfTeam = lines.filter((l) => l.teamKey === key);
    const chosen = choices.teamSizes.get(key);
    return {
      key,
      name,
      existing,
      size: existing?.size ?? (chosen !== undefined && validSize(chosen) ? chosen : null),
      needed: lineOfTeam.some((l) => l.action !== 'none'),
      lines: lineOfTeam,
      absent: existing
        ? state.projects.filter(
            (p) => p.teamId === existing.id && !exportedKeys.has(nameKey(p.name)),
          )
        : [],
    };
  });
  const teamless = lines.filter((l) => l.teamKey === null);
  if (teamless.length > 0) {
    teams.push({
      key: '',
      name: 'Sans équipe',
      existing: null,
      size: null,
      needed: false,
      lines: teamless,
      absent: [],
    });
  }

  const extraWeeks = simulate(lines, teams, state, windowStart);
  const summary = summarize(lines, teams);
  const missingSizes = teams
    .filter((t) => t.key !== '' && !t.existing && t.needed && t.size === null)
    .map((t) => t.name);
  return {
    lines,
    teams,
    windowStart,
    extraWeeks,
    missingSizes,
    ambiguous: [...ambiguous],
    summary,
    ready: missingSizes.length === 0,
  };
}

/** État, actions possibles et action retenue d'un projet de l'export. */
function classify(
  exported: ExportedProject,
  key: string,
  teamKey: string | null,
  existing: Project | null,
  today: string,
  teamById: Map<string, Team>,
  choices: PlanningChoices,
): PlanLine {
  const target = targetOf(exported, today);
  const placed = existing !== null && existing.start !== null && existing.row !== null;
  const existingTeam = existing?.teamId ? teamById.get(existing.teamId) : undefined;
  const sameTeam = existingTeam !== undefined && nameKey(existingTeam.name) === teamKey;

  let status: LineStatus;
  let actions: PlanAction[];
  let drift: Drift | null = null;

  if (!target) {
    if (Object.keys(exported.load).length > 0) {
      status = 'ended';
      actions = ['none'];
    } else {
      status = 'unplanned';
      if (!existing || existing.teamId === null) actions = ['toTray', 'none'];
      else if (!placed && !sameTeam) actions = ['none', 'toTray'];
      else actions = ['none'];
    }
  } else if (!existing) {
    status = 'new';
    actions = ['place', 'toTray', 'none'];
  } else if (!placed && (existing.teamId === null || sameTeam)) {
    status = 'toPlace';
    actions = ['place', 'none'];
  } else {
    drift = {
      team: !sameTeam,
      start: existing.start !== target.start,
      weeks: existing.weeks !== target.weeks,
      charge: Math.abs(existing.charge - target.charge) > CHARGE_TOLERANCE,
    };
    const conform = placed && !drift.team && !drift.start && !drift.weeks && !drift.charge;
    status = conform ? 'upToDate' : 'drift';
    actions = conform ? ['none'] : ['none', 'align'];
    if (conform) drift = null;
  }
  // Sans équipe dans l'export, on ne sait pas où le mettre.
  if (teamKey === null) actions = ['none'];

  const chosen = choices.actions.get(key);
  const action = chosen !== undefined && actions.includes(chosen) ? chosen : actions[0];
  return {
    key,
    name: exported.name,
    exported,
    teamKey,
    existing,
    target,
    status,
    actions,
    action,
    drift,
    outcome: { kind: 'none' },
  };
}

/**
 * Simule les poses, équipe par équipe, et renseigne `outcome` sur chaque ligne.
 * Renvoie le nombre de semaines à ajouter à la fenêtre.
 *
 * Pose « comme à la main » : à la colonne exacte de la cible, sur la ligne libre la plus basse.
 * Les alignements passent avant les poses et ne libèrent que leur propre brique : un alignement
 * sans place laisse la brique où elle était, sans qu'une autre ligne ait pu prendre cette place.
 */
function simulate(
  lines: PlanLine[],
  teams: TeamPlan[],
  state: PlanningState,
  windowStart: string,
): number {
  const moves = lines.filter((l) => (l.action === 'place' || l.action === 'align') && l.target);
  const extraWeeks = Math.max(
    0,
    ...moves.map(
      (l) => weeksBetween(windowStart, l.target!.start) + l.target!.weeks - state.window.weeks,
    ),
  );
  const boundsWeeks = state.window.weeks + extraWeeks;

  for (const team of teams) {
    for (const line of team.lines) {
      if (line.action === 'none') line.outcome = { kind: 'none' };
      else if (team.size === null) line.outcome = { kind: 'pending' };
      else if (line.action === 'toTray') line.outcome = { kind: 'tray' };
    }
    if (team.size === null) continue;
    const size = team.size;

    // Les briques posées de l'équipe, par identifiant de projet.
    const rects = new Map<string, Rect>();
    if (team.existing) {
      for (const p of state.projects) {
        const r = p.teamId === team.existing.id ? toWindowRect(p, windowStart) : null;
        if (r) rects.set(p.id, r);
      }
    }
    const byStart = (a: PlanLine, b: PlanLine) =>
      a.target!.start.localeCompare(b.target!.start) || a.name.localeCompare(b.name, 'fr');
    const aligns = team.lines.filter((l) => l.action === 'align' && l.target).sort(byStart);
    const places = team.lines.filter((l) => l.action === 'place' && l.target).sort(byStart);

    for (const line of [...aligns, ...places]) {
      const t = line.target!;
      const ownId = line.existing?.id ?? `new:${line.key}`;
      const others = [...rects].filter(([id]) => id !== ownId).map(([, r]) => r);
      const col = weeksBetween(windowStart, t.start);
      let row: number | null = null;
      for (let r = 0; r + t.persons <= size; r++) {
        if (
          canOccupy({ col, row: r, weeks: t.weeks, persons: t.persons }, others, {
            weeks: boundsWeeks,
            persons: size,
          })
        ) {
          row = r;
          break;
        }
      }
      if (row !== null) {
        line.outcome = { kind: 'placed', row };
        rects.set(ownId, { col, row, weeks: t.weeks, persons: t.persons });
      } else {
        // Sans place : un alignement laisse la brique où elle est ; une pose envoie au bac de l'équipe,
        // sauf si le projet y est déjà (ré-import) : il y reste, ce n'est pas une action.
        const alreadyInTray =
          line.existing?.teamId === team.existing?.id && line.existing?.start === null;
        line.outcome = { kind: line.action === 'align' || alreadyInTray ? 'unchanged' : 'tray' };
      }
    }
  }
  return extraWeeks;
}

function summarize(lines: PlanLine[], teams: TeamPlan[]): PlanningSummary {
  const count = (pred: (l: PlanLine) => boolean) => lines.filter(pred).length;
  const placed = count((l) => l.outcome.kind === 'placed' && l.action === 'place');
  const aligned = count((l) => l.outcome.kind === 'placed' && l.action === 'align');
  const tray = count((l) => l.outcome.kind === 'tray');
  return {
    created: count(
      (l) => !l.existing && (l.outcome.kind === 'placed' || l.outcome.kind === 'tray'),
    ),
    placed,
    aligned,
    tray,
    unchanged: count((l) => l.outcome.kind === 'unchanged'),
    teamsCreated: teams.filter((t) => t.key !== '' && !t.existing && t.needed).length,
    actions: placed + aligned + tray,
  };
}

function validSize(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_TEAM_SIZE;
}

/**
 * Le nouvel état d'après la revue : équipes créées, fenêtre agrandie, projets créés, posés,
 * alignés ou envoyés au bac de leur équipe, métadonnées complétées. L'état d'entrée n'est pas modifié.
 * `newId` est injecté pour que les tests soient déterministes.
 */
export function applyPlanning(
  state: PlanningState,
  review: PlanningReview,
  newId: (prefix: string) => string,
): PlanningState {
  if (!review.ready || review.summary.actions === 0) return state;

  const teams = [...state.teams];
  const teamIdByKey = new Map(state.teams.map((t) => [nameKey(t.name), t.id]));
  const sizeById = new Map(state.teams.map((t) => [t.id, t.size]));
  for (const plan of review.teams) {
    if (plan.key === '' || plan.existing || !plan.needed || plan.size === null) continue;
    const team: Team = { id: newId('team'), name: plan.name, size: plan.size };
    teams.push(team);
    teamIdByKey.set(plan.key, team.id);
    sizeById.set(team.id, team.size);
  }

  const window =
    review.extraWeeks > 0
      ? { ...state.window, weeks: state.window.weeks + review.extraWeeks }
      : state.window;

  const projects = [...state.projects];
  const indexById = new Map(projects.map((p, i) => [p.id, i]));
  // Rotation des pierres des nouveaux projets sans couleur, comme `store.nextColor`.
  const colorRank = new Map<string, number>();

  for (const line of review.lines) {
    const { outcome, existing, target, exported } = line;
    if (outcome.kind !== 'placed' && outcome.kind !== 'tray') continue;
    const teamId = teamIdByKey.get(line.teamKey ?? '');
    if (!teamId) continue;

    let shape: { weeks: number; persons: number; charge: number };
    if (target) {
      shape = { weeks: target.weeks, persons: target.persons, charge: target.charge };
    } else if (exported.remaining !== null && exported.remaining > 0) {
      shape = initialDims(exported.remaining, 1);
    } else if (existing) {
      shape = fitToTeam(existing, sizeById.get(teamId) ?? 1);
    } else {
      shape = initialDims(DEFAULT_TRAY_CHARGE, 1);
    }
    const start = outcome.kind === 'placed' ? target!.start : null;
    const row = outcome.kind === 'placed' ? outcome.row : null;
    const meta = {
      ...existing?.meta,
      ...exported.meta,
      ...(target ? { 'Semaines planifiées': describeLoad(target.load) } : {}),
    };

    if (existing) {
      projects[indexById.get(existing.id)!] = { ...existing, ...shape, teamId, start, row, meta };
    } else {
      const rank = colorRank.get(teamId) ?? projects.filter((p) => p.teamId === teamId).length;
      colorRank.set(teamId, rank + 1);
      projects.push({
        ...shape,
        id: newId('p'),
        teamId,
        name: line.name,
        mode: 'free',
        color:
          (exported.color ? nearestStone(exported.color) : null) ??
          STONE_COLORS[rank % STONE_COLORS.length],
        start,
        row,
        meta,
      });
    }
  }
  return { ...state, window, teams, projects };
}
