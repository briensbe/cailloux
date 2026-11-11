import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DragService } from '../state/drag.service';
import { CELL_H, ViewService } from '../state/view.service';
import { Brick } from './brick/brick';

/**
 * Calque plein écran au-dessus de tout : la brique « en main » y suit le curseur.
 * Elle vit ici plutôt que dans un vase pour pouvoir passer d'un vase à l'autre
 * sans être rognée par les zones qui défilent horizontalement.
 */
@Component({
  selector: 'app-drag-overlay',
  imports: [Brick],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (dnd.drag(); as d) {
      <app-brick
        class="floating"
        [class.no-target]="!d.target"
        [project]="d.project"
        [dims]="d.project"
        [style.left.px]="d.pointer.x - d.grab.x"
        [style.top.px]="d.pointer.y - d.grab.y"
        [style.width.px]="d.project.weeks * view.cellW()"
        [style.height.px]="d.project.persons * cellH"
      />
    }
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      pointer-events: none;
    }
  `,
})
export class DragOverlay {
  protected readonly dnd = inject(DragService);
  protected readonly view = inject(ViewService);
  protected readonly cellH = CELL_H;
}
