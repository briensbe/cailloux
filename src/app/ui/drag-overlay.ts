import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DragService } from '../state/drag.service';
import { ViewService } from '../state/view.service';
import { Brick } from './brick/brick';

/**
 * Calque plein écran au-dessus de tout : la brique « en main » y suit le curseur.
 * Elle vit ici plutôt que dans un vase pour pouvoir passer d'un vase à l'autre
 * sans être rognée par les zones qui défilent horizontalement.
 */
@Component({
  selector: 'app-drag-overlay',
  imports: [Brick, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (dnd.drag(); as d) {
      @let left = d.pointer.x - d.grab.x;
      @let top = d.pointer.y - d.grab.y;
      @let width = d.project.weeks * view.activeCellW();
      @let height = d.project.persons * view.activeCellH();
      @if (d.projects.length > 1) {
        <div
          class="stack-shadow"
          [style.left.px]="left + 6"
          [style.top.px]="top + 6"
          [style.width.px]="width"
          [style.height.px]="height"
        ></div>
      }
      <app-brick
        class="floating"
        [class.no-target]="!d.target"
        [project]="d.project"
        [dims]="d.project"
        [style.left.px]="left"
        [style.top.px]="top"
        [style.width.px]="width"
        [style.height.px]="height"
      />
      @if (d.projects.length > 1) {
        <span class="stack-badge" [style.left.px]="left + width - 8" [style.top.px]="top - 10">
          ×{{ d.projects.length }} · {{ totalCharge() | number: '1.0-1' }}&nbsp;j/h
        </span>
      }
    }
    @if (view.lasso(); as l) {
      <div
        class="lasso-rect"
        [style.left.px]="l.left"
        [style.top.px]="l.top"
        [style.width.px]="l.width"
        [style.height.px]="l.height"
      ></div>
    }
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      pointer-events: none;
    }
    .stack-shadow {
      position: absolute;
      border-radius: 10px;
      background: rgb(31 42 47 / 0.22);
      box-shadow: 4px 4px 0 rgb(31 42 47 / 0.12);
      transform: rotate(2deg);
    }
    .stack-badge {
      position: absolute;
      z-index: 2;
      padding: 3px 9px;
      border-radius: 999px;
      background: var(--ink);
      color: var(--paper);
      font: 700 11.5px var(--font-mono);
      white-space: nowrap;
      box-shadow:
        0 0 0 2px var(--paper),
        0 6px 14px -4px rgb(0 0 0 / 0.45);
      transform: translateX(-50%);
    }
  `,
})
export class DragOverlay {
  protected readonly dnd = inject(DragService);
  protected readonly view = inject(ViewService);

  protected readonly totalCharge = computed(
    () => this.dnd.drag()?.projects.reduce((sum, p) => sum + p.charge, 0) ?? 0,
  );
}
