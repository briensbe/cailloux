import { DecimalPipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { customPeriod, PERIOD_PRESETS, periodEndExclusive, periodFigures, PeriodPreset, sumFigures } from './domain/period';
import { addDays, addWeeks, formatShort, parseIsoDate, toIsoDate } from './domain/weeks';
import { PlanningStore } from './state/planning.store';
import { CELL_H, ViewService, ZOOM_MAX, ZOOM_MIN } from './state/view.service';
import { DragOverlay } from './ui/drag-overlay';
import { Icon } from './ui/icon';
import { Inspector } from './ui/inspector/inspector';
import { ProjectDialog } from './ui/project-dialog/project-dialog';
import { Reservoir } from './ui/reservoir/reservoir';
import { Stepper } from './ui/stepper';
import { Toasts } from './ui/toasts';

@Component({
  selector: 'app-root',
  imports: [Reservoir, Inspector, ProjectDialog, DragOverlay, Toasts, Icon, Stepper, DecimalPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Dimensions d'une case, exposées en variables CSS pour dessiner le quadrillage des vases.
    '[style.--cell-w]': "view.cellW() + 'px'",
    '[style.--cell-h]': "cellH + 'px'",
    '[class.with-inspector]': 'store.selected() !== null',
    '(document:keydown)': 'onKey($event)',
  },
})
export class App {
  protected readonly store = inject(PlanningStore);
  protected readonly view = inject(ViewService);
  protected readonly cellH = CELL_H;
  protected readonly zoomMin = ZOOM_MIN;
  protected readonly zoomMax = ZOOM_MAX;
  protected readonly presets = PERIOD_PRESETS;

  private readonly board = viewChild.required<ElementRef<HTMLElement>>('board');

  /** Indicateurs de la période, toutes équipes confondues. */
  protected readonly totals = computed(() => {
    const teams = this.store.teams();
    const period = this.view.period();
    return {
      teams: teams.length,
      persons: teams.reduce((sum, t) => sum + t.size, 0),
      ...sumFigures(teams.map((t) => periodFigures(t.size, this.store.projectsOf(t.id), period))),
    };
  });

  /** Libellé de la fenêtre : du premier lundi au dernier dimanche. */
  protected readonly windowLabel = computed(() => {
    const start = parseIsoDate(this.store.windowStart());
    const end = addDays(parseIsoDate(addWeeks(this.store.windowStart(), this.store.window().weeks)), -1);
    return `${formatShort(start)} → ${formatShort(end)} ${end.getFullYear()}`;
  });

  /** Bornes de la période personnalisée, pour les champs de date. */
  protected readonly periodDates = computed(() => {
    const period = this.view.period();
    return { from: period.start, to: toIsoDate(addDays(parseIsoDate(periodEndExclusive(period)), -1)) };
  });

  constructor() {
    // Le mode « tout voir » a besoin de la largeur réellement disponible pour les vases.
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.board().nativeElement;
      const observer = new ResizeObserver(() => this.view.boardWidth.set(el.clientWidth));
      observer.observe(el);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected setZoom(event: Event): void {
    this.view.setZoom(Number((event.target as HTMLInputElement).value));
  }

  protected choosePeriod(choice: PeriodPreset | 'custom'): void {
    if (choice === 'custom') this.view.setCustomPeriod(this.view.period());
    else this.view.periodChoice.set(choice);
  }

  protected setPeriodBound(bound: 'from' | 'to', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value) return;
    let { from, to } = this.periodDates();
    // Une borne saisie au-delà de l'autre l'entraîne avec elle, plutôt que d'inverser la période.
    if (bound === 'from') {
      from = value;
      if (to < from) to = from;
    } else {
      to = value;
      if (from > to) from = to;
    }
    this.view.setCustomPeriod(customPeriod(from, to));
  }

  /** Raccourcis clavier globaux (ignorés pendant la saisie dans un champ). */
  protected onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, dialog')) return;
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (key === 'z' || key === 'y')) {
      e.preventDefault();
      if (key === 'y' || e.shiftKey) this.store.redo();
      else this.store.undo();
      return;
    }
    if (e.key === 'Escape') {
      this.store.select(null);
      return;
    }
    const id = this.store.selectedId();
    if (!id) return;
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
    };
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.store.removeProject(id);
    } else if (arrows[e.key]) {
      e.preventDefault();
      this.store.nudge(id, ...arrows[e.key]);
    }
  }
}
