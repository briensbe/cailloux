import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Dims, fillRatio } from '../../domain/capacity';
import { Project, STONES } from '../../domain/model';
import { addDays, addWeeks, formatShort, parseIsoDate } from '../../domain/weeks';
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
    '[class.cut-start]': 'cutStart()',
    '[class.cut-end]': 'cutEnd()',
    '[attr.title]': 'tooltip()',
  },
})
export class Brick {
  readonly project = input.required<Project>();
  /** Forme affichée : celle du projet, ou l'aperçu pendant un redimensionnement. */
  readonly dims = input.required<Dims>();
  readonly selected = input(false);
  readonly resizable = input(false);
  /** La brique continue avant le bord gauche de la fenêtre (projet déjà commencé). */
  readonly cutStart = input(false);
  /** La brique continue après le bord droit de la fenêtre. */
  readonly cutEnd = input(false);
  readonly resizeStart = output<{ event: PointerEvent; handle: ResizeHandle }>();

  protected readonly stone = computed(() => STONES[this.project().color]);
  /** Part de « l'air » dans la brique quand la charge ne remplit pas toutes ses cases. */
  protected readonly air = computed(() => 1 - fillRatio(this.dims()));
  protected readonly tooltip = computed(() => {
    const p = this.project();
    const d = this.dims();
    const mode = p.mode === 'fixed' ? 'charge fixe' : 'libre';
    const when = p.start ? ` · du ${formatShort(parseIsoDate(p.start))} au ${formatShort(lastFriday(p.start, d.weeks))}` : '';
    return `${p.name} — ${d.charge} j/h · ${d.persons} pers. × ${d.weeks} sem. (${mode})${when}`;
  });

  protected startResize(event: PointerEvent, handle: ResizeHandle): void {
    this.resizeStart.emit({ event, handle });
  }
}

/** Vendredi de la dernière semaine d'une brique. */
function lastFriday(start: string, weeks: number): Date {
  return addDays(parseIsoDate(addWeeks(start, weeks)), -3);
}
