import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DAYS_PER_WEEK, footprint } from './domain/capacity';
import { boundsOf, PlanningStore } from './state/planning.store';
import { CELL_H, ViewService, ZOOM_MAX, ZOOM_MIN } from './state/view.service';
import { DragOverlay } from './ui/drag-overlay';
import { Icon } from './ui/icon';
import { Inspector } from './ui/inspector/inspector';
import { ProjectDialog } from './ui/project-dialog/project-dialog';
import { Reservoir } from './ui/reservoir/reservoir';
import { Toasts } from './ui/toasts';

@Component({
  selector: 'app-root',
  imports: [Reservoir, Inspector, ProjectDialog, DragOverlay, Toasts, Icon, DecimalPipe],
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

  protected readonly stats = computed(() => {
    const teams = this.store.teams();
    const capacity = teams.reduce((sum, t) => sum + footprint(boundsOf(t)), 0);
    const free = teams.reduce((sum, t) => sum + this.store.occupancy(t.id).freeCells() * DAYS_PER_WEEK, 0);
    return {
      teams: teams.length,
      persons: teams.reduce((sum, t) => sum + t.size, 0),
      capacity,
      fill: capacity ? 1 - free / capacity : 0,
    };
  });

  protected setZoom(event: Event): void {
    this.view.cellW.set(Number((event.target as HTMLInputElement).value));
  }

  protected setStartDate(event: Event): void {
    this.store.setStartDate((event.target as HTMLInputElement).value);
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
