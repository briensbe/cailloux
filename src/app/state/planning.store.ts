import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Dims, fitToTeam, initialDims } from '../domain/capacity';
import { demoState } from '../domain/demo';
import { ImportDraft } from '../domain/import';
import { applyPlanning, PlanningReview } from '../domain/planning-review';
import { Bounds, canOccupy, Cell, compact, findFirstFit, findNearestFree, Occupancy, Rect, Size } from '../domain/geometry';
import { MAX_TEAM_SIZE, newId, PlanningState, Project, StoneColor, STONE_COLORS, Team } from '../domain/model';
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
  /** Les projets du bac commun : sans équipe, toujours sans dates (ADR 0003). */
  readonly commonProjects = computed(() => this.projects().filter((p) => p.teamId === null));
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

  readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  readonly selectedId = computed(() => {
    const ids = this.selectedIds();
    return ids.size === 1 ? (ids.values().next().value ?? null) : null;
  });
  readonly selected = computed(() => {
    const id = this.selectedId();
    return id ? (this.projects().find((p) => p.id === id) ?? null) : null;
  });
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

  team(id: string | null): Team | undefined {
    return id === null ? undefined : this.teams().find((t) => t.id === id);
  }

  /** Les projets d'une équipe (posés ou dans son bac). Ne renvoie jamais le bac commun. */
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

  /** Carte d'occupation d'un vase sur la fenêtre, en ignorant éventuellement une ou plusieurs briques (celles qu'on déplace). */
  occupancy(teamId: string, except?: string | ReadonlySet<string>): Occupancy {
    const team = this.team(teamId);
    if (!team) return new Occupancy({ weeks: 0, persons: 0 }, []);
    return new Occupancy(this.bounds(team), this.rectsOf(teamId, except));
  }

  /** Rectangles occupés dans un vase sur la fenêtre, en ignorant un ensemble de briques. */
  rectsExcept(teamId: string, except: ReadonlySet<string>): Rect[] {
    return this.rectsOf(teamId, except);
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
    this.selectedIds.set(id ? new Set([id]) : new Set());
  }

  toggleSelect(id: string): void {
    this.selectedIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  selectMany(ids: readonly string[]): void {
    this.selectedIds.set(new Set(ids));
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
    // Le nouveau vase s'ajoute en bas de la page, souvent hors de l'écran : on le dit, et on propose d'y aller.
    this.toast.show(`${name} ajoutée (${team.size} personnes).`, {
      label: 'Voir',
      run: () =>
        document
          .querySelector(`app-reservoir[data-team-id="${team.id}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    });
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
    const next = Math.max(1, Math.min(MAX_TEAM_SIZE, size));
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
    // Ses projets ne sont pas perdus : ils passent au bac commun, sans leurs dates (ADR 0003).
    const s = this.current();
    const moved = this.projectsOf(id).length;
    this.commit({
      ...s,
      teams: s.teams.filter((t) => t.id !== id),
      projects: s.projects.map((p) => (p.teamId === id ? { ...p, teamId: null, start: null, row: null } : p)),
    });
    const message = !moved
      ? `${team.name} a été retirée.`
      : moved === 1
        ? `${team.name} a été retirée : son projet est passé au bac commun.`
        : `${team.name} a été retirée : ses ${moved} projets sont passés au bac commun.`;
    this.toast.show(message, { label: 'Annuler', run: () => this.undo() });
  }

  // ---------------------------------------------------------------- Projets

  /**
   * Nouveau projet : première place libre à partir de la semaine en cours. Avec `extend`,
   * la fenêtre est allongée juste assez pour qu'il tienne ; sinon il attend dans le bac.
   * Sans équipe (`teamId = null`), il va directement au bac commun, sans chercher de place.
   */
  addProject(teamId: string | null, draft: ProjectDraft, extend = false): void {
    if (teamId === null) {
      const project: Project = {
        ...draft,
        ...initialDims(draft.charge, Math.min(draft.persons, MAX_TEAM_SIZE)),
        id: newId('p'),
        teamId: null,
        name: draft.name.trim() || 'Projet sans nom',
        start: null,
        row: null,
      };
      this.commit({ ...this.current(), projects: [...this.projects(), project] });
      this.select(project.id);
      return;
    }
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
    this.select(project.id);
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

  /**
   * Déposer une brique à une case de la fenêtre déjà validée (pour sa forme recalée), dans le bac
   * de l'équipe (`cell = null`), ou dans le bac commun (`teamId = null`).
   * En entrant dans une équipe, un projet trop haut est ramené à l'effectif (`fitToTeam`).
   */
  moveProject(id: string, teamId: string | null, cell: Cell | null): void {
    const p = this.project(id);
    if (!p) return;
    if (teamId === null) {
      if (p.teamId === null) return;
      this.commit(this.withProject(id, (pr) => ({ ...pr, teamId: null, start: null, row: null })));
      return;
    }
    const team = this.team(teamId);
    if (!team) return;
    const dims = fitToTeam(p, team.size);
    const start = cell ? this.startAt(cell.col) : null;
    const row = cell?.row ?? null;
    const reshaped = dims.weeks !== p.weeks || dims.persons !== p.persons;
    if (!reshaped && p.teamId === teamId && p.start === start && p.row === row) return;
    this.commit(this.withProject(id, (pr) => ({ ...pr, ...dims, teamId, start, row })));
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
    if (r && p.teamId !== null && !this.canOccupy(p.teamId, p.id, r)) {
      const cell = findNearestFree(r, dims, this.occupancy(p.teamId, p.id));
      next = { ...next, start: cell ? this.startAt(cell.col) : null, row: cell?.row ?? null };
      if (!cell) this.toast.show(`« ${p.name} » ne tient plus dans le vase : elle attend à côté.`);
    }
    this.commit(this.withProject(id, () => next));
  }

  /** Sortir une brique du bac de son équipe et la poser à la première place libre. */
  placeProject(id: string): void {
    const p = this.project(id);
    const team = this.team(p?.teamId ?? null);
    if (!p || !team) return;
    const cell = findFirstFit(fitToTeam(p, team.size), this.occupancy(team.id, p.id), this.fromCol());
    if (!cell) {
      this.toast.show(`Pas assez de place dans le vase pour « ${p.name} ».`);
      return;
    }
    this.moveProject(id, team.id, cell);
    this.markDropped(id);
  }

  /** Changer d'équipe depuis l'inspecteur : recalé à l'effectif, posé à la première place libre ou dans le bac. */
  moveToTeam(id: string, teamId: string | null): void {
    const p = this.project(id);
    if (!p || p.teamId === teamId) return;
    if (teamId === null) {
      this.moveProject(id, null, null);
      return;
    }
    const team = this.team(teamId);
    if (!team) return;
    const cell = findFirstFit(fitToTeam(p, team.size), this.occupancy(teamId, p.id), this.fromCol());
    this.moveProject(id, teamId, cell);
    if (cell) this.markDropped(id);
    else this.toast.show(`« ${p.name} » ne tient pas dans ce vase : elle attend à côté.`);
  }

  /**
   * Déplace un lot de projets vers une équipe en une seule transaction annulable (Ctrl+Z).
   * En mode `tray`, tous rejoignent le bac d'attente de l'équipe ; en mode `place`, les plus gros
   * cailloux sont posés en premier à la première place libre, et ceux qui ne rentrent pas attendent
   * dans le bac de l'équipe.
   */
  moveProjectsToTeam(ids: readonly string[], teamId: string, mode: 'tray' | 'place'): void {
    const team = this.team(teamId);
    if (!team) return;
    const idSet = new Set(ids);
    const targets = this.projects().filter((p) => idSet.has(p.id));
    if (targets.length === 0) return;

    const updates = new Map<string, Project>();
    let placedCount = 0;
    let trayCount = 0;
    let lastPlacedId: string | null = null;

    if (mode === 'tray') {
      for (const p of targets) {
        const dims = fitToTeam(p, team.size);
        updates.set(p.id, { ...p, ...dims, teamId, start: null, row: null });
        trayCount++;
      }
    } else {
      const sorted = [...targets].sort((a, b) => b.charge - a.charge);
      const placedRects = [...this.rectsOf(teamId)];
      const bounds = this.bounds(team);
      const fromCol = this.fromCol();
      for (const p of sorted) {
        const dims = fitToTeam(p, team.size);
        const occ = new Occupancy(bounds, placedRects);
        const cell = findFirstFit(dims, occ, fromCol);
        if (cell) {
          placedRects.push({ ...cell, ...dims });
          updates.set(p.id, { ...p, ...dims, teamId, start: this.startAt(cell.col), row: cell.row });
          placedCount++;
          lastPlacedId = p.id;
        } else {
          updates.set(p.id, { ...p, ...dims, teamId, start: null, row: null });
          trayCount++;
        }
      }
    }

    this.commit({
      ...this.current(),
      projects: this.projects().map((p) => updates.get(p.id) ?? p),
    });
    this.select(null);

    if (placedCount === 1 && trayCount === 0 && lastPlacedId) {
      this.markDropped(lastPlacedId);
    }

    if (targets.some((p) => p.teamId !== teamId)) {
      let message: string;
      if (mode === 'tray') {
        message = `${trayCount} ${trayCount > 1 ? 'cailloux déplacés' : 'caillou déplacé'} dans le bac d'attente de ${team.name}.`;
      } else if (placedCount > 0 && trayCount === 0) {
        message = `${placedCount} ${placedCount > 1 ? 'cailloux placés' : 'caillou placé'} dans ${team.name}.`;
      } else if (placedCount > 0 && trayCount > 0) {
        message = `${placedCount} ${placedCount > 1 ? 'placés' : 'placé'} dans ${team.name}, ${trayCount} en attente faute de place.`;
      } else {
        message = `Pas de place dans le vase de ${team.name} : ${trayCount} ${trayCount > 1 ? 'cailloux mis' : 'caillou mis'} en attente.`;
      }
      this.toast.show(message, { label: 'Annuler', run: () => this.undo() });
    }
  }

  /** Remet un lot de projets dans le bac commun (sans équipe ni dates) en une seule transaction annulable. */
  moveProjectsToCommon(ids: readonly string[]): void {
    const idSet = new Set(ids);
    const targets = this.projects().filter((p) => idSet.has(p.id) && p.teamId !== null);
    if (targets.length === 0) return;

    const targetIds = new Set(targets.map((p) => p.id));
    this.commit({
      ...this.current(),
      projects: this.projects().map((p) => (targetIds.has(p.id) ? { ...p, teamId: null, start: null, row: null } : p)),
    });
    this.select(null);

    const n = targets.length;
    this.toast.show(`${n} ${n > 1 ? 'cailloux remis' : 'caillou remis'} dans le bac commun.`, {
      label: 'Annuler',
      run: () => this.undo(),
    });
  }

  /**
   * Applique un lot de placements déjà calculés (par ex. lors d'un glisser-déposer groupé)
   * en une seule transaction annulable.
   */
  placeProjectsInTeam(
    teamId: string,
    placements: readonly { project: Project; cell: Cell | null; dims: Dims }[],
  ): void {
    const team = this.team(teamId);
    if (!team || placements.length === 0) return;

    const updates = new Map<string, Project>();
    let placedCount = 0;
    let trayCount = 0;
    for (const { project: p, cell, dims } of placements) {
      if (cell) {
        updates.set(p.id, { ...p, ...dims, teamId, start: this.startAt(cell.col), row: cell.row });
        placedCount++;
      } else {
        updates.set(p.id, { ...p, ...dims, teamId, start: null, row: null });
        trayCount++;
      }
    }

    this.commit({
      ...this.current(),
      projects: this.projects().map((p) => updates.get(p.id) ?? p),
    });
    this.select(null);

    if (placements.some(({ project: p }) => p.teamId !== teamId)) {
      const message =
        trayCount === 0
          ? `${placedCount} ${placedCount > 1 ? 'cailloux placés' : 'caillou placé'} dans ${team.name}.`
          : `${placedCount} ${placedCount > 1 ? 'placés' : 'placé'} dans ${team.name}, ${trayCount} en attente faute de place.`;
      this.toast.show(message, { label: 'Annuler', run: () => this.undo() });
    }
  }

  /** Déplacement au clavier, case par case (y compris pour un projet déjà commencé). */
  nudge(id: string, dCol: number, dRow: number): void {
    const p = this.project(id);
    const r = p && this.windowRect(p);
    if (!p || !r || p.teamId === null) return;
    const target = { ...r, col: r.col + dCol, row: r.row + dRow };
    if (this.canOccupy(p.teamId, p.id, target)) this.moveProject(id, p.teamId, target);
  }

  removeProject(id: string): void {
    this.removeProjects([id]);
  }

  /** Retire un ou plusieurs projets en une seule transaction annulable. */
  removeProjects(ids: readonly string[]): void {
    const idSet = new Set(ids);
    const removed = this.projects().filter((pr) => idSet.has(pr.id));
    if (removed.length === 0) return;
    this.commit({ ...this.current(), projects: this.projects().filter((pr) => !idSet.has(pr.id)) });
    if ([...this.selectedIds()].some((id) => idSet.has(id))) {
      this.selectedIds.update((prev) => {
        const next = new Set(prev);
        for (const id of idSet) next.delete(id);
        return next;
      });
    }
    const msg =
      removed.length === 1
        ? `« ${removed[0].name} » a été retiré.`
        : `${removed.length} projets ont été retirés.`;
    this.toast.show(msg, { label: 'Annuler', run: () => this.undo() });
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

  /**
   * Crée d'un coup des projets importés dans le bac commun : sans équipe ni dates, en charge fixe,
   * sur une personne. Un seul `commit()`, donc un seul Ctrl+Z pour tout annuler.
   * Les doublons ont déjà été écartés par l'aperçu (`reviewImport`), calculé sur l'état courant.
   */
  importProjects(drafts: readonly ImportDraft[]): void {
    if (drafts.length === 0) return;
    const created = drafts.map(
      (d): Project => ({
        ...initialDims(d.charge, 1),
        id: newId('p'),
        teamId: null,
        name: d.name,
        mode: 'fixed',
        color: d.color,
        start: null,
        row: null,
        meta: d.meta,
      }),
    );
    this.commit({ ...this.current(), projects: [...this.projects(), ...created] });
    const n = created.length;
    this.toast.show(`${n} ${n > 1 ? 'projets importés' : 'projet importé'} dans le bac commun.`, {
      label: 'Annuler',
      run: () => this.undo(),
    });
  }

  /**
   * Applique une comparaison avec un export de planification (`reviewPlanning`) : équipes créées,
   * fenêtre agrandie, projets créés, posés, alignés ou rangés. Un seul `commit()`, donc un seul Ctrl+Z.
   * La revue a été calculée sur l'état courant (le dialogue est modal, rien n'a pu changer entre-temps).
   */
  applyPlanning(review: PlanningReview): void {
    if (!review.ready || review.summary.actions === 0) return;
    this.commit(applyPlanning(this.current(), review, newId));
    const s = review.summary;
    const parts = [
      s.placed + s.aligned > 0 ? `${s.placed + s.aligned} ${s.placed + s.aligned > 1 ? 'posés' : 'posé'}` : '',
      s.tray > 0 ? `${s.tray} au bac d'équipe` : '',
      s.teamsCreated > 0 ? `${s.teamsCreated} ${s.teamsCreated > 1 ? 'équipes créées' : 'équipe créée'}` : '',
    ].filter(Boolean);
    this.toast.show(`Planification importée : ${parts.join(', ')}.`, { label: 'Annuler', run: () => this.undo() });
  }

  resetDemo(): void {
    this.commit(demoState());
    this.select(null);
    this.toast.show('Démo rechargée.', { label: 'Annuler', run: () => this.undo() });
  }

  nextColor(teamId: string | null): StoneColor {
    const used = teamId === null ? this.commonProjects().length : this.projectsOf(teamId).length;
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

  private rectsOf(teamId: string, except?: string | ReadonlySet<string>): Rect[] {
    const isExcluded = (id: string) => (typeof except === 'string' ? id === except : except?.has(id) ?? false);
    return this.projectsOf(teamId)
      .filter((p) => !isExcluded(p.id))
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
