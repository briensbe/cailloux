import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Dims, initialDims } from '../domain/capacity';
import { demoState } from '../domain/demo';
import { Bounds, Cell, compact, findFirstFit, findNearestFree, Occupancy, Rect } from '../domain/geometry';
import { newId, PlanningState, Project, StoneColor, STONE_COLORS, Team } from '../domain/model';
import { mondayOf, parseIsoDate, toIsoDate } from '../domain/weeks';
import { ToastService } from './toast.service';

const STORAGE_KEY = 'cailloux.state.v1';
const HISTORY_LIMIT = 80;
const TEAM_NAMES = ['Galets', 'Silex', 'Basalte', 'Quartz', 'Granit', 'Ardoise', 'Obsidienne', 'Jaspe', 'Agate', 'Onyx'];

export type ProjectDraft = Pick<Project, 'name' | 'charge' | 'persons' | 'mode' | 'color'>;

export function boundsOf(team: Team): Bounds {
  return { weeks: team.horizon, persons: team.size };
}

export function rectOf(p: Project): Rect | null {
  return p.col === null || p.row === null ? null : { col: p.col, row: p.row, weeks: p.weeks, persons: p.persons };
}

/**
 * La source de vérité de l'application.
 *
 * L'état est un objet immuable rangé dans un signal : chaque modification produit
 * un nouvel objet (jamais de mutation en place). C'est ce qui rend l'annulation triviale :
 * on empile simplement les états précédents dans `past`.
 */
@Injectable({ providedIn: 'root' })
export class PlanningStore {
  private readonly toast = inject(ToastService);

  private readonly current = signal<PlanningState>(loadState() ?? demoState());
  private readonly past = signal<PlanningState[]>([]);
  private readonly future = signal<PlanningState[]>([]);

  readonly teams = computed(() => this.current().teams);
  readonly projects = computed(() => this.current().projects);
  readonly startDate = computed(() => this.current().startDate);
  readonly canUndo = computed(() => this.past().length > 0);
  readonly canRedo = computed(() => this.future().length > 0);

  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.projects().find((p) => p.id === this.selectedId()) ?? null);
  /** La brique qui vient de tomber dans un vase (déclenche l'animation de chute). */
  readonly justDropped = signal<string | null>(null);

  constructor() {
    // Sauvegarde automatique : l'effet se relance à chaque nouvel état.
    effect(() => saveState(this.current()));
  }

  team(id: string): Team | undefined {
    return this.teams().find((t) => t.id === id);
  }

  /** Carte d'occupation d'un vase, en ignorant éventuellement une brique (celle qu'on déplace). */
  occupancy(teamId: string, exceptId?: string): Occupancy {
    const team = this.team(teamId);
    if (!team) return new Occupancy({ weeks: 0, persons: 0 }, []);
    const rects = this.projects()
      .filter((p) => p.teamId === teamId && p.id !== exceptId)
      .map(rectOf)
      .filter((r): r is Rect => r !== null);
    return new Occupancy(boundsOf(team), rects);
  }

  select(id: string | null): void {
    this.selectedId.set(id);
  }

  // ---------------------------------------------------------------- Équipes

  addTeam(): void {
    const used = new Set(this.teams().map((t) => t.name));
    const name =
      TEAM_NAMES.map((n) => `Équipe ${n}`).find((n) => !used.has(n)) ?? `Équipe ${this.teams().length + 1}`;
    const team: Team = { id: newId('team'), name, size: 4, horizon: 12 };
    this.commit({ ...this.current(), teams: [...this.teams(), team] });
  }

  renameTeam(id: string, name: string): void {
    const clean = name.trim();
    if (!clean || clean === this.team(id)?.name) return;
    this.commit(this.withTeam(id, (t) => ({ ...t, name: clean })));
  }

  setTeamSize(id: string, size: number): void {
    this.reshapeTeam(id, { size: Math.max(1, Math.min(30, size)) });
  }

  setHorizon(id: string, horizon: number): void {
    this.reshapeTeam(id, { horizon: Math.max(1, Math.min(52, horizon)) });
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

  /** Rétrécir un vase fait déborder les briques qui n'y tiennent plus : elles passent « en attente ». */
  private reshapeTeam(id: string, patch: Partial<Team>): void {
    const team = this.team(id);
    if (!team) return;
    const next = { ...team, ...patch };
    if (next.size === team.size && next.horizon === team.horizon) return;
    const occ = new Occupancy(boundsOf(next), []);
    let overflow = 0;
    const s = this.current();
    this.commit({
      ...s,
      teams: s.teams.map((t) => (t.id === id ? next : t)),
      projects: s.projects.map((p) => {
        const r = rectOf(p);
        if (p.teamId !== id || !r || occ.contains(r)) return p;
        overflow++;
        return { ...p, col: null, row: null };
      }),
    });
    if (overflow) {
      this.toast.show(overflow === 1 ? 'Une brique a débordé du vase.' : `${overflow} briques ont débordé du vase.`);
    }
  }

  // ---------------------------------------------------------------- Projets

  addProject(teamId: string, draft: ProjectDraft): void {
    const team = this.team(teamId);
    if (!team) return;
    const dims = initialDims(draft.charge, Math.min(draft.persons, team.size));
    const cell = findFirstFit(dims, this.occupancy(teamId));
    const project: Project = {
      ...draft,
      ...dims,
      id: newId('p'),
      teamId,
      name: draft.name.trim() || 'Projet sans nom',
      col: cell?.col ?? null,
      row: cell?.row ?? null,
    };
    this.commit({ ...this.current(), projects: [...this.projects(), project] });
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

  /** Déposer une brique à un endroit déjà validé (drag & drop), ou dans le bac d'attente (`cell = null`). */
  moveProject(id: string, teamId: string, cell: Cell | null): void {
    const p = this.project(id);
    if (!p) return;
    if (p.teamId === teamId && p.col === (cell?.col ?? null) && p.row === (cell?.row ?? null)) return;
    this.commit(this.withProject(id, (pr) => ({ ...pr, teamId, col: cell?.col ?? null, row: cell?.row ?? null })));
  }

  /** Nouvelle forme validée par la poignée de redimensionnement (la place est garantie libre). */
  resizeProject(id: string, dims: Dims): void {
    const p = this.project(id);
    if (!p || (p.weeks === dims.weeks && p.persons === dims.persons && p.charge === dims.charge)) return;
    this.commit(this.withProject(id, (pr) => ({ ...pr, ...dims })));
  }

  /**
   * Nouvelle forme saisie dans l'inspecteur : la brique reste en place si elle le peut,
   * sinon elle glisse vers la place libre la plus proche, sinon elle sort du vase.
   */
  reshapeProject(id: string, dims: Dims): void {
    const p = this.project(id);
    if (!p) return;
    let next: Project = { ...p, ...dims };
    const r = rectOf(next);
    if (r) {
      const occ = this.occupancy(p.teamId, p.id);
      if (!occ.isFree(r)) {
        const cell = findNearestFree(r, dims, occ);
        next = { ...next, col: cell?.col ?? null, row: cell?.row ?? null };
        if (!cell) this.toast.show(`« ${p.name} » ne tient plus dans le vase : elle attend à côté.`);
      }
    }
    this.commit(this.withProject(id, () => next));
  }

  /** Sortir une brique du bac et la poser à la première place libre. */
  placeProject(id: string): void {
    const p = this.project(id);
    if (!p) return;
    const cell = findFirstFit(p, this.occupancy(p.teamId, p.id));
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
    const cell = findFirstFit(p, this.occupancy(teamId, p.id));
    this.moveProject(id, teamId, cell);
    if (cell) this.markDropped(id);
    else this.toast.show(`« ${p.name} » ne tient pas dans ce vase : elle attend à côté.`);
  }

  /** Déplacement au clavier, case par case. */
  nudge(id: string, dCol: number, dRow: number): void {
    const p = this.project(id);
    const r = p && rectOf(p);
    if (!p || !r) return;
    const target = { ...r, col: r.col + dCol, row: r.row + dRow };
    if (this.occupancy(p.teamId, p.id).isFree(target)) this.moveProject(id, p.teamId, target);
  }

  removeProject(id: string): void {
    const p = this.project(id);
    if (!p) return;
    this.commit({ ...this.current(), projects: this.projects().filter((pr) => pr.id !== id) });
    if (this.selectedId() === id) this.selectedId.set(null);
    this.toast.show(`« ${p.name} » a été retiré.`, { label: 'Annuler', run: () => this.undo() });
  }

  /** « Secouer le vase » : tout glisse vers le début et le fond. */
  compactTeam(teamId: string): void {
    const placed = this.projects().filter((p) => p.teamId === teamId && p.col !== null);
    const cells = compact(placed.map((p) => ({ ...rectOf(p)!, id: p.id })));
    const changed = placed.some((p) => cells.get(p.id)?.col !== p.col || cells.get(p.id)?.row !== p.row);
    if (!changed) {
      this.toast.show('Le vase est déjà bien tassé.');
      return;
    }
    this.commit({
      ...this.current(),
      projects: this.projects().map((p) => (cells.has(p.id) ? { ...p, ...cells.get(p.id)! } : p)),
    });
  }

  setStartDate(iso: string): void {
    if (!iso) return;
    const monday = toIsoDate(mondayOf(parseIsoDate(iso)));
    if (monday !== this.startDate()) this.commit({ ...this.current(), startDate: monday });
  }

  resetDemo(): void {
    this.commit(demoState());
    this.selectedId.set(null);
    this.toast.show('Démo rechargée.', { label: 'Annuler', run: () => this.undo() });
  }

  nextColor(teamId: string): StoneColor {
    const used = this.projects().filter((p) => p.teamId === teamId).length;
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
    return Array.isArray(state.teams) && Array.isArray(state.projects) && state.startDate ? state : null;
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
