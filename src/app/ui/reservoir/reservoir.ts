import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Dims, freeResize, withPersons, withWeeks } from '../../domain/capacity';
import { largestFreeRect, Occupancy, Rect } from '../../domain/geometry';
import { MAX_TEAM_SIZE, Project, STONES, Team } from '../../domain/model';
import { periodFigures, periodOccupancy } from '../../domain/period';
import { isOverflowing, outsideSide } from '../../domain/window';
import { addWeeks, weekLabels, weeksBetween } from '../../domain/weeks';
import { DragService } from '../../state/drag.service';
import { PlanningStore } from '../../state/planning.store';
import { CELL_H, ViewService } from '../../state/view.service';
import { Brick, ResizeHandle } from '../brick/brick';
import { Icon } from '../icon';
import { Stepper } from '../stepper';

/** Une brique posée, vue dans la fenêtre : son rectangle complet et la partie dessinée. */
interface Placed {
  p: Project;
  r: Rect;
}

/** Le vase d'une équipe : sa grille, ses briques, son bac d'attente et ses indicateurs de période. */
@Component({
  selector: 'app-reservoir',
  imports: [Brick, Stepper, Icon, DecimalPipe],
  templateUrl: './reservoir.html',
  styleUrl: './reservoir.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.compact]': 'view.cellW() < 54',
    '[class.tiny]': 'view.cellW() < 30',
  },
})
export class Reservoir {
  readonly team = input.required<Team>();

  protected readonly store = inject(PlanningStore);
  protected readonly view = inject(ViewService);
  protected readonly dnd = inject(DragService);
  protected readonly cellH = CELL_H;
  protected readonly maxTeamSize = MAX_TEAM_SIZE;

  protected readonly windowWeeks = computed(() => this.store.window().weeks);
  protected readonly projects = computed(() => this.store.projectsOf(this.team().id));
  /** Le bac de l'équipe, des plus gros projets aux plus petits : les gros cailloux d'abord. */
  protected readonly waiting = computed(() =>
    this.projects()
      .filter((p) => p.start === null)
      .sort((a, b) => b.charge - a.charge),
  );
  private readonly placed = computed(() =>
    this.projects()
      .map((p) => ({ p, r: this.store.windowRect(p) }))
      .filter((x): x is Placed => x.r !== null),
  );
  /** Les briques dont au moins une semaine tombe dans la fenêtre. */
  protected readonly visible = computed(() =>
    this.placed().filter(({ r }) => outsideSide(r, this.windowWeeks()) === null),
  );
  /** Les briques cachées de chaque côté de la fenêtre. */
  protected readonly hidden = computed(() => {
    const side = (s: 'before' | 'after') =>
      this.placed().filter(({ r }) => outsideSide(r, this.windowWeeks()) === s).map(({ p }) => p.name);
    return { before: side('before'), after: side('after') };
  });
  protected readonly overflowCount = computed(
    () => this.placed().filter(({ r }) => isOverflowing(r, this.team().size)).length,
  );
  /** Lignes au-dessus du rebord à réserver pour dessiner les briques en débordement. */
  protected readonly headroom = computed(() =>
    Math.max(0, ...this.visible().map(({ r }) => r.row + r.persons - this.team().size)),
  );

  protected readonly occupancy = computed(
    () => new Occupancy(this.store.bounds(this.team()), this.visible().map(({ r }) => r)),
  );
  protected readonly freePerWeek = computed(() => this.occupancy().freePerWeek());

  // ---------------------------------------------------------------- Période

  protected readonly figures = computed(() => periodFigures(this.team().size, this.projects(), this.view.period()));
  protected readonly biggest = computed(() =>
    largestFreeRect(periodOccupancy(this.team().size, this.projects(), this.view.period())),
  );
  /** Sélection d'une période à la souris sur l'axe du temps, en cours. */
  protected readonly selecting = signal<{ from: number; to: number } | null>(null);
  /** Colonnes de la période (ou de la sélection en cours), limitées à la fenêtre. */
  protected readonly periodCols = computed(() => {
    const s = this.selecting();
    const [from, to] = s
      ? [Math.min(s.from, s.to), Math.max(s.from, s.to) + 1]
      : (() => {
          const start = weeksBetween(this.store.windowStart(), this.view.period().start);
          return [start, start + this.view.period().weeks];
        })();
    const left = Math.max(0, from);
    const right = Math.min(this.windowWeeks(), to);
    return right > left ? { from: left, to: right } : null;
  });

  protected readonly weeks = computed(() => {
    const cols = this.periodCols();
    return weekLabels(this.store.windowStart(), this.windowWeeks()).map((w) => ({
      ...w,
      inPeriod: cols !== null && w.index >= cols.from && w.index < cols.to,
    }));
  });
  protected readonly rows = computed(() => Array.from({ length: this.team().size }, (_, i) => i + 1));
  protected readonly gridW = computed(() => this.windowWeeks() * this.view.cellW());
  protected readonly gridH = computed(() => this.team().size * CELL_H);

  /** Position du jour courant dans la grille (en px), s'il est dans la fenêtre. */
  protected readonly todayX = computed(() => {
    const col = this.store.todayCol();
    if (col < 0 || col >= this.windowWeeks()) return null;
    const dayOfWeek = (new Date().getDay() + 6) % 7;
    return (col + (dayOfWeek + 0.5) / 7) * this.view.cellW();
  });

  // ---------------------------------------------------------------- Glisser-déposer

  protected readonly draggingId = computed(() => this.dnd.drag()?.project.id ?? null);
  /** Le fantôme qui montre où la brique déplacée va s'aimanter dans ce vase. */
  protected readonly ghost = computed(() => {
    const d = this.dnd.drag();
    const t = d?.target;
    if (!d || t?.kind !== 'grid' || t.teamId !== this.team().id) return null;
    // La forme recalée : un projet trop haut pour ce vase y entre ramené à l'effectif.
    return { ...t.cell, weeks: t.dims.weeks, persons: t.dims.persons, stone: STONES[d.project.color].base };
  });
  protected readonly trayActive = computed(() => {
    const t = this.dnd.drag()?.target;
    return t?.kind === 'tray' && t.teamId === this.team().id;
  });

  protected readonly water = signal(false);
  protected readonly resizing = signal<{ id: string; dims: Dims } | null>(null);

  protected dimsOf(p: Project): Dims {
    const r = this.resizing();
    return r?.id === p.id ? r.dims : p;
  }

  /** La partie de la brique dessinée dans la fenêtre, en pixels, et ses bords coupés. */
  protected drawn({ p, r }: Placed): {
    left: number;
    bottom: number;
    width: number;
    height: number;
    cutStart: boolean;
    cutEnd: boolean;
  } {
    const d = this.dimsOf(p);
    const cw = this.view.cellW();
    const from = Math.max(0, r.col);
    const to = Math.min(this.windowWeeks(), r.col + d.weeks);
    return {
      left: from * cw,
      bottom: r.row * CELL_H,
      width: (to - from) * cw,
      height: d.persons * CELL_H,
      cutStart: r.col < 0,
      cutEnd: r.col + d.weeks > this.windowWeeks(),
    };
  }

  /** Un rectangle en pixels, coupé aux bords de la fenêtre. */
  protected rect(r: Rect): { left: number; bottom: number; width: number; height: number } {
    const cw = this.view.cellW();
    const from = Math.max(0, r.col);
    const to = Math.min(this.windowWeeks(), r.col + r.weeks);
    return { left: from * cw, bottom: r.row * CELL_H, width: (to - from) * cw, height: r.persons * CELL_H };
  }

  protected miniSize(p: Project): { w: number; h: number } {
    return {
      w: Math.max(64, Math.min(260, p.weeks * Math.max(this.view.cellW(), 36) * 0.5)),
      h: Math.max(30, Math.min(110, p.persons * CELL_H * 0.5)),
    };
  }

  protected hiddenTitle(names: string[]): string {
    return `${names.join(', ')} — cliquer pour les montrer`;
  }

  protected rename(event: Event): void {
    this.store.renameTeam(this.team().id, (event.target as HTMLInputElement).value);
  }

  protected onGridPointerDown(event: PointerEvent): void {
    if (event.target === event.currentTarget) this.store.select(null);
  }

  /**
   * Choisir une période personnalisée en glissant sur l'axe du temps.
   * Le résultat est toujours fait de semaines entières.
   */
  protected startPeriodSelection(event: PointerEvent): void {
    if (event.button !== 0) return;
    const axis = event.currentTarget as HTMLElement;
    const grid = axis.closest('.vase-area')?.querySelector<HTMLElement>('[data-grid]');
    if (!grid) return;
    event.preventDefault();
    axis.setPointerCapture(event.pointerId);
    const colAt = (x: number) => {
      const col = Math.floor((x - grid.getBoundingClientRect().left) / this.view.cellW());
      return Math.max(0, Math.min(this.windowWeeks() - 1, col));
    };
    const from = colAt(event.clientX);
    this.selecting.set({ from, to: from });

    const move = (e: PointerEvent) => this.selecting.set({ from, to: colAt(e.clientX) });
    const end = () => {
      axis.removeEventListener('pointermove', move);
      axis.removeEventListener('pointerup', end);
      axis.removeEventListener('pointercancel', end);
      const s = this.selecting();
      this.selecting.set(null);
      if (!s) return;
      const first = Math.min(s.from, s.to);
      this.view.setCustomPeriod({
        start: addWeeks(this.store.windowStart(), first),
        weeks: Math.abs(s.to - s.from) + 1,
      });
    };
    axis.addEventListener('pointermove', move);
    axis.addEventListener('pointerup', end);
    axis.addEventListener('pointercancel', end);
  }

  /**
   * Redimensionnement à la poignée.
   * On avance case par case vers la taille visée et on s'arrête contre le premier obstacle :
   * la brique « bute » sur ses voisines, l'effectif et le bord droit au lieu de sauter par-dessus.
   */
  protected startResize(event: PointerEvent, { p, r }: Placed, handle: ResizeHandle): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const handleEl = event.target as HTMLElement;
    // La « capture » envoie tous les mouvements à la poignée, même si le curseur la quitte.
    handleEl.setPointerCapture(event.pointerId);
    this.store.select(p.id);

    const teamId = this.team().id;
    const maxPersons = this.team().size;
    const fits = (d: Dims) => this.store.canOccupy(teamId, p.id, { ...r, weeks: d.weeks, persons: d.persons });
    const start = { x: event.clientX, y: event.clientY };
    const base: Dims = { weeks: p.weeks, persons: p.persons, charge: p.charge };
    this.resizing.set({ id: p.id, dims: base });

    const move = (e: PointerEvent) => {
      const dWeeks = Math.round((e.clientX - start.x) / this.view.cellW());
      const dPersons = Math.round((start.y - e.clientY) / CELL_H);
      let dims = base;
      if (handle === 'e') {
        dims = walk(base, p.weeks, p.weeks + dWeeks, (w) => withWeeks(p, w, maxPersons), fits);
      } else if (handle === 'n') {
        dims = walk(base, p.persons, p.persons + dPersons, (h) => withPersons(p, h, maxPersons), fits);
      } else {
        const wide = walk(base, p.weeks, p.weeks + dWeeks, (w) => freeResize(p, w, p.persons), fits);
        const top = Math.min(maxPersons, p.persons + dPersons);
        dims = walk(wide, p.persons, top, (h) => freeResize(p, wide.weeks, Math.max(1, h)), fits);
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
}

/** Avance pas à pas de `from` vers `to` et garde la dernière forme qui tient dans le vase. */
function walk(
  initial: Dims,
  from: number,
  to: number,
  make: (value: number) => Dims,
  fits: (d: Dims) => boolean,
): Dims {
  let best = initial;
  const step = Math.sign(to - from);
  for (let v = from + step; step !== 0 && (step > 0 ? v <= to : v >= to); v += step) {
    const d = make(v);
    if (!fits(d)) break;
    best = d;
  }
  return best;
}
