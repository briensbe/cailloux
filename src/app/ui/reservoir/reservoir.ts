import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DAYS_PER_WEEK, Dims, footprint, freeResize, withPersons, withWeeks } from '../../domain/capacity';
import { largestFreeRect, Occupancy, Rect } from '../../domain/geometry';
import { Project, STONES, Team } from '../../domain/model';
import { parseIsoDate, weekLabels } from '../../domain/weeks';
import { DragService } from '../../state/drag.service';
import { boundsOf, PlanningStore, rectOf } from '../../state/planning.store';
import { CELL_H, ViewService } from '../../state/view.service';
import { Brick, ResizeHandle } from '../brick/brick';
import { Icon } from '../icon';
import { Stepper } from '../stepper';

const DAY_MS = 86_400_000;

/** Le vase d'une équipe : sa grille, ses briques, son bac d'attente et ses indicateurs. */
@Component({
  selector: 'app-reservoir',
  imports: [Brick, Stepper, Icon, DecimalPipe],
  templateUrl: './reservoir.html',
  styleUrl: './reservoir.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.compact]': 'view.cellW() < 54' },
})
export class Reservoir {
  readonly team = input.required<Team>();

  protected readonly store = inject(PlanningStore);
  protected readonly view = inject(ViewService);
  protected readonly dnd = inject(DragService);
  protected readonly cellH = CELL_H;

  protected readonly projects = computed(() => this.store.projects().filter((p) => p.teamId === this.team().id));
  protected readonly placed = computed(() => this.projects().filter((p) => p.col !== null));
  protected readonly waiting = computed(() => this.projects().filter((p) => p.col === null));

  protected readonly occupancy = computed(
    () => new Occupancy(boundsOf(this.team()), this.placed().map((p) => rectOf(p)!)),
  );
  protected readonly capacity = computed(() => footprint(boundsOf(this.team())));
  protected readonly freeDays = computed(() => this.occupancy().freeCells() * DAYS_PER_WEEK);
  protected readonly fill = computed(() => 1 - this.freeDays() / this.capacity());
  protected readonly biggest = computed(() => largestFreeRect(this.occupancy()));
  protected readonly freePerWeek = computed(() => this.occupancy().freePerWeek());

  protected readonly weeks = computed(() => weekLabels(this.store.startDate(), this.team().horizon));
  protected readonly rows = computed(() => Array.from({ length: this.team().size }, (_, i) => i + 1));
  protected readonly gridW = computed(() => this.team().horizon * this.view.cellW());
  protected readonly gridH = computed(() => this.team().size * CELL_H);

  /** Position du jour courant dans la grille (en px), si elle est dans l'horizon. */
  protected readonly todayX = computed(() => {
    const days = Math.floor((Date.now() - parseIsoDate(this.store.startDate()).getTime()) / DAY_MS);
    if (days < 0 || days >= this.team().horizon * 7) return null;
    return ((days + 0.5) / 7) * this.view.cellW();
  });

  protected readonly draggingId = computed(() => this.dnd.drag()?.project.id ?? null);
  /** Le fantôme qui montre où la brique déplacée va s'aimanter dans ce vase. */
  protected readonly ghost = computed(() => {
    const d = this.dnd.drag();
    const t = d?.target;
    if (!d || t?.kind !== 'grid' || t.teamId !== this.team().id) return null;
    return { ...t.cell, weeks: d.project.weeks, persons: d.project.persons, stone: STONES[d.project.color].base };
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

  protected miniSize(p: Project): { w: number; h: number } {
    return {
      w: Math.max(64, Math.min(260, p.weeks * this.view.cellW() * 0.5)),
      h: Math.max(30, Math.min(110, p.persons * CELL_H * 0.5)),
    };
  }

  protected rename(event: Event): void {
    this.store.renameTeam(this.team().id, (event.target as HTMLInputElement).value);
  }

  protected onGridPointerDown(event: PointerEvent): void {
    if (event.target === event.currentTarget) this.store.select(null);
  }

  /**
   * Redimensionnement à la poignée.
   * On avance case par case vers la taille visée et on s'arrête contre le premier obstacle :
   * la brique « bute » sur ses voisines au lieu de sauter par-dessus.
   */
  protected startResize(event: PointerEvent, p: Project, handle: ResizeHandle): void {
    if (event.button !== 0 || p.col === null || p.row === null) return;
    event.preventDefault();
    event.stopPropagation();
    const handleEl = event.target as HTMLElement;
    // La « capture » envoie tous les mouvements à la poignée, même si le curseur la quitte.
    handleEl.setPointerCapture(event.pointerId);
    this.store.select(p.id);

    const maxPersons = this.team().size;
    const occ = this.store.occupancy(this.team().id, p.id);
    const fits = (d: Dims) => occ.isFree({ col: p.col!, row: p.row!, weeks: d.weeks, persons: d.persons });
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

  protected rect(r: Rect): { left: number; bottom: number; width: number; height: number } {
    const cw = this.view.cellW();
    return { left: r.col * cw, bottom: r.row * CELL_H, width: r.weeks * cw, height: r.persons * CELL_H };
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
