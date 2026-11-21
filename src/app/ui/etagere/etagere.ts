import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Dims, freeResize, walkDims, withPersons, withWeeks } from '../../domain/capacity';
import { Rect } from '../../domain/geometry';
import { Project, STONES, Team } from '../../domain/model';
import { PeriodFigures, periodFigures, sumFigures } from '../../domain/period';
import { freePersonsPerWeek, isOverflowing, outsideSide, toWindowRect } from '../../domain/window';
import { weekLabels, weeksBetween } from '../../domain/weeks';
import { DragService } from '../../state/drag.service';
import { PlanningStore } from '../../state/planning.store';
import { SHELF_ROW_H, ViewService } from '../../state/view.service';
import { ResizeHandle } from '../brick/brick';

export { SHELF_ROW_H };
/** Largeur minimale d'une brique pour y écrire son nom (tronqué par « … » au besoin). */
const NAME_MIN_W = 28;
/** Hauteur minimale d'une ligne de l'Étagère, pour que l'en-tête de l'équipe tienne : base, plus une ligne par pastille. */
const LANE_MIN_H = 64;
const TAG_H = 19;
const LANE_PAD = 18;

interface ShelfBrick {
  id: string;
  project: Project;
  rect: Rect;
  hiddenWeeks: number;
  name: string;
  title: string;
  base: string;
  ink: string;
  left: number;
  width: number;
  bottom: number;
  height: number;
  overflow: boolean;
  cutStart: boolean;
  cutEnd: boolean;
  /** Assez large pour y écrire le nom. */
  labelled: boolean;
  selected: boolean;
  dragging: boolean;
  landing: boolean;
}

interface ShelfLane {
  team: Team;
  figures: PeriodFigures;
  waitingCount: number;
  bricks: ShelfBrick[];
  before: number;
  after: number;
  overflow: number;
  /** Hauteur du vase (effectif) et de la zone de débordement au-dessus du rebord, en pixels. */
  vaseH: number;
  overH: number;
  /** Hauteur de la ligne entière, identique pour l'en-tête et pour le vase. */
  laneH: number;
}

/**
 * L'Étagère : tous les vases en miniature sous une même règle du temps, pour comparer les équipes
 * d'un coup d'œil et y ajuster directement les projets (spec `etagere`).
 *
 * Mise en page : chaque rangée (bande des personnes libres, règle, vases) a une colonne d'en-têtes
 * et une colonne de temps. Seule la colonne de temps des vases défile horizontalement ; la bande
 * et la règle la suivent par `scrollLeft`. Un seul conteneur qui défilerait dans les deux sens
 * empêcherait la règle de rester collée en haut de l'écran (`position: sticky`).
 */
@Component({
  selector: 'app-etagere',
  imports: [DecimalPipe],
  templateUrl: './etagere.html',
  styleUrl: './etagere.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Etagere {
  protected readonly store = inject(PlanningStore);
  protected readonly view = inject(ViewService);
  private readonly dnd = inject(DragService);
  protected readonly rowH = SHELF_ROW_H;
  protected readonly resizing = signal<{ id: string; dims: Dims } | null>(null);

  protected readonly cw = this.view.shelfCellW;
  protected readonly weeks = computed(() => this.store.window().weeks);
  protected readonly gridW = computed(() => this.weeks() * this.cw());
  protected readonly labels = computed(() => weekLabels(this.store.windowStart(), this.weeks()));

  /** Colonnes de la période, limitées à la fenêtre. */
  protected readonly periodCols = computed(() => {
    const p = this.view.period();
    const start = weeksBetween(this.store.windowStart(), p.start);
    const from = Math.max(0, start);
    const to = Math.min(this.weeks(), start + p.weeks);
    return to > from ? { from, to } : null;
  });

  protected readonly todayX = computed(() => {
    const col = this.store.todayCol();
    return col >= 0 && col < this.weeks() ? (col + 0.5) * this.cw() : null;
  });

  protected readonly lanes = computed<ShelfLane[]>(() =>
    this.store.teams().map((team) => this.lane(team, this.store.projectsOf(team.id))),
  );

  protected readonly totals = computed(() => sumFigures(this.lanes().map((l) => l.figures)));

  /** Bande « personnes libres chaque semaine, toutes équipes ». */
  protected readonly free = computed(() => {
    const teams = this.store.teams();
    const counts = freePersonsPerWeek(teams, this.store.projects(), this.store.windowStart(), this.weeks());
    const persons = teams.reduce((n, t) => n + t.size, 0);
    return counts.map((n) => ({ n, pct: persons ? (n / persons) * 100 : 0 }));
  });

  protected inPeriod(index: number): boolean {
    const pc = this.periodCols();
    return pc !== null && index >= pc.from && index < pc.to;
  }

  /** La colonne de temps des vases entraîne la bande et la règle. */
  protected syncScroll(event: Event, ...followers: HTMLElement[]): void {
    const left = (event.target as HTMLElement).scrollLeft;
    for (const el of followers) el.scrollLeft = left;
  }

  protected ghostFor(teamId: string): { left: number; bottom: number; width: number; height: number; stone: string } | null {
    const d = this.dnd.drag();
    const t = d?.target;
    if (!d || t?.kind !== 'grid' || t.teamId !== teamId) return null;
    const cw = this.cw();
    const from = Math.max(0, t.cell.col);
    const to = Math.min(this.weeks(), t.cell.col + t.dims.weeks);
    return {
      left: from * cw,
      bottom: t.cell.row * SHELF_ROW_H,
      width: (to - from) * cw,
      height: t.dims.persons * SHELF_ROW_H,
      stone: STONES[d.project.color].base,
    };
  }

  protected onGridPointerDown(event: PointerEvent): void {
    if (event.target !== event.currentTarget) return;
    this.view.inspectorOpen.set(false);
    this.store.select(null);
  }

  protected pressBrick(event: PointerEvent, b: ShelfBrick): void {
    this.dnd.press(event, b.project, b.hiddenWeeks);
  }

  protected openDetails(b: ShelfBrick): void {
    this.view.openInspector(b.id);
  }

  protected startResize(event: PointerEvent, b: ShelfBrick, team: Team, handle: ResizeHandle): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const handleEl = event.target as HTMLElement;
    handleEl.setPointerCapture(event.pointerId);
    this.store.select(b.id);

    const p = b.project;
    const r = b.rect;
    const maxPersons = team.size;
    const fits = (d: Dims) => this.store.canOccupy(team.id, p.id, { ...r, weeks: d.weeks, persons: d.persons });
    const start = { x: event.clientX, y: event.clientY };
    const base: Dims = { weeks: p.weeks, persons: p.persons, charge: p.charge };
    this.resizing.set({ id: p.id, dims: base });

    const move = (e: PointerEvent) => {
      const dWeeks = Math.round((e.clientX - start.x) / this.cw());
      const dPersons = Math.round((start.y - e.clientY) / SHELF_ROW_H);
      let dims = base;
      if (handle === 'e') {
        dims = walkDims(base, p.weeks, p.weeks + dWeeks, (w) => withWeeks(p, w, maxPersons), fits);
      } else if (handle === 'n') {
        dims = walkDims(base, p.persons, p.persons + dPersons, (h) => withPersons(p, h, maxPersons), fits);
      } else {
        const wide = walkDims(base, p.weeks, p.weeks + dWeeks, (w) => freeResize(p, w, p.persons), fits);
        const top = Math.min(maxPersons, p.persons + dPersons);
        dims = walkDims(wide, p.persons, top, (h) => freeResize(p, wide.weeks, Math.max(1, h)), fits);
      }
      this.resizing.set({ id: p.id, dims });
    };
    const end = () => {
      handleEl.removeEventListener('pointermove', move);
      handleEl.removeEventListener('pointerup', end);
      handleEl.removeEventListener('pointercancel', end);
      const final = this.resizing();
      this.resizing.set(null);
      if (final) this.store.resizeProject(p.id, final.dims);
    };
    handleEl.addEventListener('pointermove', move);
    handleEl.addEventListener('pointerup', end);
    handleEl.addEventListener('pointercancel', end);
  }

  private dimsOf(p: Project): Dims {
    const r = this.resizing();
    return r?.id === p.id ? r.dims : p;
  }

  private lane(team: Team, projects: Project[]): ShelfLane {
    const weeks = this.weeks();
    const cw = this.cw();
    const selectedIds = this.store.selectedIds();
    const draggingId = this.dnd.drag()?.project.id ?? null;
    const landingId = this.dnd.landing();
    const placed = projects
      .map((p) => ({ p, r: toWindowRect(p, this.store.windowStart()) }))
      .filter((x): x is { p: Project; r: NonNullable<typeof x.r> } => x.r !== null);
    const visible = placed.filter(({ r }) => outsideSide(r, weeks) === null);
    const headroom = Math.max(0, ...visible.map(({ p, r }) => r.row + this.dimsOf(p).persons - team.size));
    const vaseH = team.size * SHELF_ROW_H;
    const overH = headroom * SHELF_ROW_H;
    const waitingCount = projects.filter((p) => p.start === null).length;
    const overflow = placed.filter(({ r }) => isOverflowing(r, team.size)).length;
    const tags = (waitingCount ? 1 : 0) + (overflow ? 1 : 0);
    return {
      team,
      figures: periodFigures(team.size, projects, this.view.period()),
      waitingCount,
      bricks: visible.map(({ p, r }) => {
        const d = this.dimsOf(p);
        const from = Math.max(0, r.col);
        const to = Math.min(weeks, r.col + d.weeks);
        return {
          id: p.id,
          project: p,
          rect: r,
          hiddenWeeks: Math.max(0, -r.col),
          name: p.name,
          title: `${p.name} — ${d.charge} j/h · ${d.persons} pers. × ${d.weeks} sem.`,
          base: STONES[p.color].base,
          ink: STONES[p.color].ink,
          left: from * cw,
          width: (to - from) * cw,
          bottom: r.row * SHELF_ROW_H,
          height: d.persons * SHELF_ROW_H,
          overflow: isOverflowing({ ...r, weeks: d.weeks, persons: d.persons }, team.size),
          cutStart: r.col < 0,
          cutEnd: r.col + d.weeks > weeks,
          labelled: (to - from) * cw >= NAME_MIN_W,
          selected: selectedIds.has(p.id),
          dragging: draggingId === p.id,
          landing: landingId === p.id,
        };
      }),
      before: placed.filter(({ r }) => outsideSide(r, weeks) === 'before').length,
      after: placed.filter(({ r }) => outsideSide(r, weeks) === 'after').length,
      overflow,
      vaseH,
      overH,
      laneH: Math.max(LANE_MIN_H + Math.max(1, tags) * TAG_H, vaseH + overH + LANE_PAD),
    };
  }
}
