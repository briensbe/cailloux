import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Dims, fillRatio } from '../../domain/capacity';
import { Project, STONES } from '../../domain/model';
import { Icon } from '../icon';

export type ResizeHandle = 'e' | 'n' | 'ne';

/**
 * Une brique « caillou ». Composant purement visuel : il ne connaît ni la grille ni le store.
 * Sa position et sa taille en pixels sont posées par le parent (vase, bac ou calque de drag).
 */
@Component({
  selector: 'app-brick',
  imports: [Icon, DecimalPipe],
  templateUrl: './brick.html',
  styleUrl: './brick.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--stone]': 'stone().base',
    '[style.--stone-ink]': 'stone().ink',
    '[class.is-fixed]': "project().mode === 'fixed'",
    '[class.is-selected]': 'selected()',
    '[attr.title]': 'tooltip()',
  },
})
export class Brick {
  readonly project = input.required<Project>();
  /** Forme affichée : celle du projet, ou l'aperçu pendant un redimensionnement. */
  readonly dims = input.required<Dims>();
  readonly selected = input(false);
  readonly resizable = input(false);
  readonly resizeStart = output<{ event: PointerEvent; handle: ResizeHandle }>();

  protected readonly stone = computed(() => STONES[this.project().color]);
  /** Part de « l'air » dans la brique quand la charge ne remplit pas toutes ses cases. */
  protected readonly air = computed(() => 1 - fillRatio(this.dims()));
  protected readonly tooltip = computed(() => {
    const d = this.dims();
    const mode = this.project().mode === 'fixed' ? 'charge fixe' : 'libre';
    return `${this.project().name} — ${d.charge} j/h · ${d.persons} pers. × ${d.weeks} sem. (${mode})`;
  });

  protected startResize(event: PointerEvent, handle: ResizeHandle): void {
    this.resizeStart.emit({ event, handle });
  }
}
