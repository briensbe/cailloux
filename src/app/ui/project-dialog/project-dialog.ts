import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { initialDims } from '../../domain/capacity';
import { findFirstFit, Rect } from '../../domain/geometry';
import { LoadMode, StoneColor, STONE_COLORS, STONES, stoneKind } from '../../domain/model';
import { addDays, formatShort, isoWeek, parseIsoDate } from '../../domain/weeks';
import { PlanningStore, rectOf } from '../../state/planning.store';
import { CELL_H, ViewService } from '../../state/view.service';
import { Icon } from '../icon';

const PREVIEW_MAX_W = 250;
const PREVIEW_MAX_H = 150;

/**
 * Fenêtre « Nouveau caillou » : on saisit la charge et le nombre de personnes,
 * et l'aperçu montre tout de suite la forme de la brique et si elle tient dans le vase.
 */
@Component({
  selector: 'app-project-dialog',
  imports: [FormsModule, Icon],
  templateUrl: './project-dialog.html',
  styleUrl: './project-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDialog {
  protected readonly store = inject(PlanningStore);
  protected readonly view = inject(ViewService);
  protected readonly colors = STONE_COLORS;
  protected readonly stones = STONES;
  protected readonly presets = [5, 10, 20, 40, 80, 120];

  protected readonly team = computed(() => {
    const id = this.view.newProjectFor();
    return id ? (this.store.team(id) ?? null) : null;
  });

  // Chaque champ du formulaire est un signal, lié en double sens avec [(ngModel)].
  protected readonly name = signal('');
  protected readonly charge = signal(20);
  protected readonly persons = signal(1);
  protected readonly mode = signal<LoadMode>('free');
  protected readonly color = signal<StoneColor>('terracotta');

  protected readonly dims = computed(() => {
    const size = this.team()?.size ?? 1;
    return initialDims(this.charge() > 0 ? this.charge() : 1, Math.min(this.persons(), size));
  });
  protected readonly kind = computed(() => stoneKind(this.dims().charge));

  /** Où la brique tomberait si on la déposait maintenant. */
  protected readonly landing = computed(() => {
    const t = this.team();
    if (!t) return null;
    const cell = findFirstFit(this.dims(), this.store.occupancy(t.id));
    if (!cell) return null;
    const monday = addDays(parseIsoDate(this.store.startDate()), cell.col * 7);
    return { ...cell, label: `S${isoWeek(monday)}, ${formatShort(monday)}` };
  });

  protected readonly placed = computed(() => {
    const t = this.team();
    if (!t) return [];
    return this.store
      .projects()
      .filter((p) => p.teamId === t.id)
      .map(rectOf)
      .filter((r): r is Rect => r !== null);
  });

  /** Le vase miniature garde les proportions du vrai. */
  protected readonly preview = computed(() => {
    const t = this.team();
    if (!t) return { w: 0, h: 0 };
    const w = t.horizon * this.view.cellW();
    const h = t.size * CELL_H;
    const scale = Math.min(PREVIEW_MAX_W / w, PREVIEW_MAX_H / h);
    return { w: w * scale, h: h * scale };
  });

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // Réinitialise le formulaire à chaque ouverture, avec toute l'équipe en parallèle par défaut.
    effect(() => {
      const t = this.team();
      if (!t) return;
      untracked(() => {
        this.name.set('');
        this.charge.set(20);
        this.persons.set(t.size);
        this.mode.set('free');
        this.color.set(this.store.nextColor(t.id));
      });
    });
    // showModal() agit sur le DOM : on attend que la balise <dialog> soit rendue.
    afterRenderEffect(() => {
      const el = this.dialog()?.nativeElement;
      if (el && !el.open) el.showModal();
    });
  }

  protected pct(value: number, total: number): number {
    return (value / total) * 100;
  }

  protected create(): void {
    const t = this.team();
    if (!t || !(this.charge() > 0)) return;
    this.store.addProject(t.id, {
      name: this.name(),
      charge: this.charge(),
      persons: this.persons(),
      mode: this.mode(),
      color: this.color(),
    });
    this.close();
  }

  protected close(): void {
    this.dialog()?.nativeElement.close();
  }

  /** Fermeture par le bouton, par Échap ou après création. */
  protected onClosed(): void {
    this.view.newProjectFor.set(null);
  }
}
