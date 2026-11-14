import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { Project } from '../../domain/model';
import { commonWaiting, periodFigures } from '../../domain/period';
import { DragService } from '../../state/drag.service';
import { PlanningStore } from '../../state/planning.store';
import { CELL_H, ViewService } from '../../state/view.service';
import { Brick } from '../brick/brick';
import { Icon } from '../icon';

/** Hauteur réservée en bas de page pour que le dock ne masque pas le dernier vase. */
const DOCK_OPEN_PX = 168;
const DOCK_CLOSED_PX = 64;

/**
 * Le dock du bac commun (ADR 0003) : fixé en bas de l'écran, visible quel que soit le défilement.
 * En mode Vases, c'est une zone de dépôt (`data-drop-kind="common"`) et ses briques se glissent vers
 * les vases ; sur l'Étagère, il est en lecture seule.
 */
@Component({
  selector: 'app-dock',
  imports: [Brick, Icon, DecimalPipe],
  templateUrl: './dock.html',
  styleUrl: './dock.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.height.px]': 'reserved()' },
})
export class Dock {
  protected readonly store = inject(PlanningStore);
  protected readonly view = inject(ViewService);
  protected readonly dnd = inject(DragService);

  protected readonly readOnly = computed(() => this.view.mode() === 'etagere');
  /** Les gros cailloux d'abord. */
  protected readonly projects = computed(() => [...this.store.commonProjects()].sort((a, b) => b.charge - a.charge));
  protected readonly waiting = computed(() => {
    const period = this.view.period();
    const teams = this.store.teams().map((t) => periodFigures(t.size, this.store.projectsOf(t.id), period));
    return commonWaiting(this.store.projects(), teams);
  });
  protected readonly reserved = computed(() => (this.view.dockOpen() ? DOCK_OPEN_PX : DOCK_CLOSED_PX));

  protected readonly draggingId = computed(() => this.dnd.drag()?.project.id ?? null);
  /** Une brique d'équipe survole le dock : il s'allume pour montrer qu'on peut l'y lâcher. */
  protected readonly active = computed(() => this.dnd.drag()?.target?.kind === 'common');

  constructor() {
    // Les toasts se posent juste au-dessus du dock.
    effect(() => document.documentElement.style.setProperty('--dock-h', `${this.reserved()}px`));
  }

  protected miniSize(p: Project): { w: number; h: number } {
    return {
      w: Math.max(64, Math.min(240, p.weeks * 20)),
      h: Math.max(30, Math.min(84, p.persons * CELL_H * 0.4)),
    };
  }

  protected press(event: PointerEvent, p: Project): void {
    if (this.readOnly()) return;
    this.dnd.press(event, p, 0, true);
  }

  protected select(p: Project): void {
    if (!this.readOnly()) this.store.select(p.id);
  }
}
