import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Dims, initialDims } from '../domain/capacity';
import { demoState } from '../domain/demo';
import { Bounds, canOccupy, Cell, compact, findFirstFit, findNearestFree, Occupancy, Rect, Size } from '../domain/geometry';
import { newId, PlanningState, Project, StoneColor, STONE_COLORS, Team } from '../domain/model';
import { effectiveWindowStart, extensionToFit, isOverflowing, outsideSide, toWindowRect } from '../domain/window';
import { addWeeks, currentMonday, weeksBetween } from '../domain/weeks';
import { ToastService } from './toast.service';

// v2 : briques ancrées sur des dates et fenêtre commune (ADR 0001). Les sauvegardes v1 sont ignorées.
const STORAGE_KEY = 'cailloux.state.v2';
const HISTORY_LIMIT = 80;
const TEAM_NAMES = ['Galets', 'Silex', 'Basalte', 'Quartz', 'Granit', 'Ardoise', 'Obsidienne', 'Jaspe', 'Agate', 'Onyx'];

export type ProjectDraft = Pick<Project, 'name' | 'charge' | 'persons' | 'mode' | 'color'>;

/**
 * La source de vérité de l'application.
 *
 * L'état est un objet immuable rangé dans un signal : chaque modification produit
 * un nouvel objet (jamais de mutation en place). C'est ce qui rend l'annulation triviale :
 * on empile simplement les états précédents dans `past`.
 *
 * Les briques sont stockées avec des dates ; la géométrie travaille en colonnes de la fenêtre.
 * Le store fait la conversion dans les deux sens (`windowRect`, `startAt`).
 */
@Injectable({ providedIn: 'root' })
export class PlanningStore {
  private readonly toast = inject(ToastService);

  private readonly current = signal<PlanningState>(loadState() ?? demoState());
  private readonly past = signal<PlanningState[]>([]);
  private readonly future = signal<PlanningState[]>([]);

  readonly teams = computed(() => this.current().teams);
  readonly projects = computed(() => this.current().projects);
  readonly window = computed(() => this.current().window);
  readonly canUndo = computed(() => this.past().length > 0);
  readonly canRedo = computed(() => this.future().length > 0);

  /** Lundi de la semaine en cours, figé à l'ouverture de l'application. */
  readonly today = currentMonday();
  readonly windowStart = computed(() => effectiveWindowStart(this.window()));
  readonly sliding = computed(() => this.window().start === null);
  /** Colonne de la semaine en cours (négative si la fenêtre est décalée vers le futur). */
  readonly todayCol = computed(() => weeksBetween(this.windowStart(), this.today));
  /** Colonne d'où partent placements et tassements : la semaine en cours, ramenée dans la fenêtre. */
  private readonly fromCol = computed(() => Math.max(0, this.todayCol()));

  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.projects().find((p) => p.id === this.selectedId()) ?? null);
  /** La brique qui vient de tomber dans un vase (déclenche l'animation de chute). */
  readonly justDropped = signal<string | null>(null);

  /** Les briques posées entièrement hors de la fenêtre, toutes équipes confondues. */
  readonly outsideCount = computed(() => {
    const weeks = this.window().weeks;
    return this.projects().filter((p) => {
      const r = this.windowRect(p);
      return r !== null && outsideSide(r, weeks) !== null;
    }).length;
  });
  /** Les briques qui dépassent l'effectif de leur équipe. */
  readonly overflowCount = computed(
    () =>
      this.projects().filter((p) => {
        const r = this.windowRect(p);
        const team = this.team(p.teamId);
        return r !== null && team !== undefined && isOverflowing(r, team.size);
      }).length,
  );

  constructor() {
    // Sauvegarde automatique : l'effet se relance à chaque nouvel état.
    effect(() => saveState(this.current()));
  }

  team(id: string): Team | undefined {
    return this.teams().find((t) => t.id === id);
  }

  projectsOf(teamId: string): Project[] {
    return this.projects().filter((p) => p.teamId === teamId);
  }

  /** La brique dans le repère de la fenêtre (colonne négative si elle a commencé avant). */
  windowRect(p: Project): Rect | null {
    return toWindowRect(p, this.windowStart());
  }

  bounds(team: Team): Bounds {
    return { weeks: this.window().weeks, persons: team.size };
  }

  /** Carte d'occupation d'un vase sur la fenêtre, en ignorant éventuellement une brique (celle qu'on déplace). */
  occupancy(teamId: string, exceptId?: string): Occupancy {
    const team = this.team(teamId);
    if (!team) return new Occupancy({ weeks: 0, persons: 0 }, []);
    return new Occupancy(this.bounds(team), this.rectsOf(teamId, exceptId));
  }

  /** Une brique déjà posée peut-elle prendre cette forme / cette place ? (Gestes : poignées, flèches, inspecteur.) */
  canOccupy(teamId: string, exceptId: string, r: Rect): boolean {
    const team = this.team(teamId);
    return team !== undefined && canOccupy(r, this.rectsOf(teamId, exceptId), this.bounds(team));
  }

  /** Nombre de semaines à ajouter à la fenêtre pour qu'un projet de cette taille trouve une place. */
  extensionFor(teamId: string, size: Size): number | null {
    const team = this.team(teamId);
    if (!team) return null;
    return extensionToFit(size, this.rectsOf(teamId), this.bounds(team), this.fromCol());
  }

  select(id: string | null): void {
    this.selectedId.set(id);
  }

  // ---------------------------------------------------------------- Fenêtre

  /** Décaler la fenêtre ; revenir pile sur la semaine en cours la rend de nouveau glissante. */
  shiftWindow(deltaWeeks: number): void {
    if (!deltaWeeks) return;
    const start = addWeeks(this.windowStart(), deltaWeeks);
    this.commitWindow({ start: start === this.today ? null : start });
  }

  windowToToday(): void {
    if (this.sliding()) return;
    this.commitWindow({ start: null });
  }

  /** Allonger ou raccourcir la fenêtre ; les briques au-delà du nouveau bord gardent leurs dates. */
  setWindowWeeks(weeks: number): void {
    const next = Math.max(1, Math.round(weeks));
    if (next === this.window().weeks) return;
    this.commitWindow({ weeks: next });
  }

  /** Décaler ou allonger la fenêtre juste assez pour montrer les briques cachées d'un côté d'un vase. */
  revealOutside(teamId: string, side: 'before' | 'after'): void {
    const weeks = this.window().weeks;
    const hidden = this.rectsOf(teamId).filter((r) => outsideSide(r, weeks) === side);
    if (!hidden.length) return;
    if (side === 'before') {
      this.shiftWindow(Math.min(...hidden.map((r) => r.col)));
    } else {
      this.setWindowWeeks(Math.max(...hidden.map((r) => r.col + r.weeks)));
    }
  }

  private commitWindow(patch: Partial<PlanningState['window']>): void {
    const s = this.current();
    this.commit({ ...s, window: { ...s.window, ...patch } });
  }

  // ---------------------------------------------------------------- Équipes

  addTeam(): void {
    const used = new Set(this.teams().map((t) => t.name));
    const name =
      TEAM_NAMES.map((n) => `Équipe ${n}`).find((n) => !used.has(n)) ?? `Équipe ${this.teams().length + 1}`;
    const team: Team = { id: newId('team'), name, size: 4 };
    this.commit({ ...this.current(), teams: [...this.teams(), team] });
  }

  renameTeam(id: string, name: string): void {
    const clean = name.trim();
    if (!clean || clean === this.team(id)?.name) return;
    this.commit(this.withTeam(id, (t) => ({ ...t, name: clean })));
  }

  /**
   * Changer l'effectif ne déplace aucune brique (ADR 0002) : celles qui dépassent
   * la nouvelle hauteur restent en place et sont signalées en débordement.
   */
  setTeamSize(id: string, size: number): void {
    const team = this.team(id);
    const next = Math.max(1, Math.min(30, size));
    if (!team || next === team.size) return;
    this.commit(this.withTeam(id, (t) => ({ ...t, size: next })));
    const overflow = this.projectsOf(id).filter((p) => {
      const r = this.windowRect(p);
      return r !== null && isOverflowing(r, next);
    }).length;
    if (overflow) {
      this.toast.show(overflow === 1 ? 'Une brique déborde du vase.' : `${overflow} briques débordent du vase.`);
    }
  }

  removeTeam(id: string): void {
    const team = this.team(id);
    if (!team) return;
    const s = this.current();
    this.commit({
      ...s,
      teams: s.teams.filter((t) => t.id !== id),
      projects: s.projects.filter((p) => p.teamId !== id),
    });
    this.toast.show(`${team.name} a été retirée.`, { label: 'Annuler', run: () => this.undo() });
  }

  // ---------------------------------------------------------------- Projets

  /**
   * Nouveau projet : première place libre à partir de la semaine en cours. Avec `extend`,
   * la fenêtre est allongée juste assez pour qu'il tienne ; sinon il attend dans le bac.
   */
  addProject(teamId: string, draft: ProjectDraft, extend = false): void {
    const team = this.team(teamId);
    if (!team) return;
    const dims = initialDims(draft.charge, Math.min(draft.persons, team.size));
    let window = this.window();
    let cell = findFirstFit(dims, this.occupancy(teamId), this.fromCol());
    if (!cell && extend) {
      const extra = this.extensionFor(teamId, dims);
      if (extra !== null) {
        window = { ...window, weeks: window.weeks + extra };
        const occ = new Occupancy({ weeks: window.weeks, persons: team.size }, this.rectsOf(teamId));
        cell = findFirstFit(dims, occ, this.fromCol());
      }
    }
    const project: Project = {
      ...draft,
      ...dims,
      id: newId('p'),
      teamId,
      name: draft.name.trim() || 'Projet sans nom',
      start: cell ? this.startAt(cell.col) : null,
      row: cell?.row ?? null,
    };
    this.commit({ ...this.current(), window, projects: [...this.projects(), project] });
    this.selectedId.set(project.id);
    if (cell) {
      this.markDropped(project.id);
    } else {
      this.toast.show(`Le vase déborde : « ${project.name} » attend à côté.`);
    }
  }

  updateProject(id: string, patch: Partial<Pick<Project, 'name' | 'color' | 'mode'>>): void {
    const p = this.project(id);
    if (!p || Object.entries(patch).every(([k, v]) => p[k as keyof Project] === v)) return;
    this.commit(this.withProject(id, (pr) => ({ ...pr, ...patch })));
  }

  /** Déposer une brique à une case de la fenêtre déjà validée, ou dans le bac d'attente (`cell = null`). */
  moveProject(id: string, teamId: string, cell: Cell | null): void {
    const p = this.project(id);
    if (!p) return;
    const start = cell ? this.startAt(cell.col) : null;
    const row = cell?.row ?? null;
    if (p.teamId === teamId && p.start === start && p.row === row) return;
    this.commit(this.withProject(id, (pr) => ({ ...pr, teamId, start, row })));
  }

  /** Nouvelle forme validée par la poignée de redimensionnement (la place est garantie libre). */
  resizeProject(id: string, dims: Dims): void {
    const p = this.project(id);
    if (!p || (p.weeks === dims.weeks && p.persons === dims.persons && p.charge === dims.charge)) return;
    this.commit(this.withProject(id, (pr) => ({ ...pr, ...dims })));
  }

  /**
   * Nouvelle forme saisie dans l'inspecteur : la brique reste en place si elle le peut,
   * sinon elle glisse vers la place libre la plus proche de la fenêtre, sinon elle sort du vase.
   */
  reshapeProject(id: string, dims: Dims): void {
    const p = this.project(id);
    if (!p) return;
    let next: Project = { ...p, ...dims };
    const r = this.windowRect(next);
    if (r && !this.canOccupy(p.teamId, p.id, r)) {
      const cell = findNearestFree(r, dims, this.occupancy(p.teamId, p.id));
      next = { ...next, start: cell ? this.startAt(cell.col) : null, row: cell?.row ?? null };
      if (!cell) this.toast.show(`« ${p.name} » ne tient plus dans le vase : elle attend à côté.`);
    }
    this.commit(this.withProject(id, () => next));
  }

  /** Sortir une brique du bac et la poser à la première place libre. */
  placeProject(id: string): void {
    const p = this.project(id);
    if (!p) return;
    const cell = findFirstFit(p, this.occupancy(p.teamId, p.id), this.fromCol());
    if (!cell) {
      this.toast.show(`Pas assez de place dans le vase pour « ${p.name} ».`);
      return;
    }
    this.moveProject(id, p.teamId, cell);
    this.markDropped(id);
  }

  moveToTeam(id: string, teamId: string): void {
    const p = this.project(id);
    if (!p || p.teamId === teamId) return;
    const cell = findFirstFit(p, this.occupancy(teamId, p.id), this.fromCol());
    this.moveProject(id, teamId, cell);
    if (cell) this.markDropped(id);
    else this.toast.show(`« ${p.name} » ne tient pas dans ce vase : elle attend à côté.`);
  }

  /** Déplacement au clavier, case par case (y compris pour un projet déjà commencé). */
  nudge(id: string, dCol: number, dRow: number): void {
    const p = this.project(id);
    const r = p && this.windowRect(p);
    if (!p || !r) return;
    const target = { ...r, col: r.col + dCol, row: r.row + dRow };
    if (this.canOccupy(p.teamId, p.id, target)) this.moveProject(id, p.teamId, target);
  }

  removeProject(id: string): void {
    const p = this.project(id);
    if (!p) return;
    this.commit({ ...this.current(), projects: this.projects().filter((pr) => pr.id !== id) });
    if (this.selectedId() === id) this.selectedId.set(null);
    this.toast.show(`« ${p.name} » a été retiré.`, { label: 'Annuler', run: () => this.undo() });
  }

  /** « Secouer le vase » : tout glisse vers la semaine en cours et vers le fond ; le passé ne bouge pas. */
  compactTeam(teamId: string): void {
    const placed = this.projectsOf(teamId)
      .map((p) => ({ p, r: this.windowRect(p) }))
      .filter((x): x is { p: Project; r: Rect } => x.r !== null);
    const cells = compact(
      placed.map(({ p, r }) => ({ ...r, id: p.id })),
      this.todayCol(),
    );
    const changed = placed.some(({ p, r }) => cells.get(p.id)?.col !== r.col || cells.get(p.id)?.row !== r.row);
    if (!changed) {
      this.toast.show('Le vase est déjà bien tassé.');
      return;
    }
    this.commit({
      ...this.current(),
      projects: this.projects().map((p) => {
        const cell = cells.get(p.id);
        return cell ? { ...p, start: this.startAt(cell.col), row: cell.row } : p;
      }),
    });
  }

  resetDemo(): void {
    this.commit(demoState());
    this.selectedId.set(null);
    this.toast.show('Démo rechargée.', { label: 'Annuler', run: () => this.undo() });
  }

  nextColor(teamId: string): StoneColor {
    const used = this.projectsOf(teamId).length;
    return STONE_COLORS[used % STONE_COLORS.length];
  }

  // ---------------------------------------------------------------- Historique

  undo(): void {
    const previous = this.past().at(-1);
    if (!previous) return;
    this.past.update((list) => list.slice(0, -1));
    this.future.update((list) => [this.current(), ...list]);
    this.current.set(previous);
  }

  redo(): void {
    const next = this.future()[0];
    if (!next) return;
    this.future.update((list) => list.slice(1));
    this.past.update((list) => [...list, this.current()]);
    this.current.set(next);
  }

  private commit(next: PlanningState): void {
    this.past.update((list) => [...list.slice(-(HISTORY_LIMIT - 1)), this.current()]);
    this.future.set([]);
    this.current.set(next);
  }

  // ---------------------------------------------------------------- Aides

  /** Lundi correspondant à une colonne de la fenêtre. */
  private startAt(col: number): string {
    return addWeeks(this.windowStart(), col);
  }

  private rectsOf(teamId: string, exceptId?: string): Rect[] {
    return this.projectsOf(teamId)
      .filter((p) => p.id !== exceptId)
      .map((p) => this.windowRect(p))
      .filter((r): r is Rect => r !== null);
  }

  private project(id: string): Project | undefined {
    return this.projects().find((p) => p.id === id);
  }

  private withProject(id: string, fn: (p: Project) => Project): PlanningState {
    const s = this.current();
    return { ...s, projects: s.projects.map((p) => (p.id === id ? fn(p) : p)) };
  }

  private withTeam(id: string, fn: (t: Team) => Team): PlanningState {
    const s = this.current();
    return { ...s, teams: s.teams.map((t) => (t.id === id ? fn(t) : t)) };
  }

  private markDropped(id: string): void {
    this.justDropped.set(id);
    setTimeout(() => this.justDropped.update((v) => (v === id ? null : v)), 900);
  }
}

function loadState(): PlanningState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as PlanningState;
    const valid =
      Array.isArray(state.teams) && Array.isArray(state.projects) && typeof state.window?.weeks === 'number';
    return valid ? state : null;
  } catch {
    return null;
  }
}

function saveState(state: PlanningState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota dépassé ou stockage désactivé : l'application reste utilisable, sans persistance.
  }
}
