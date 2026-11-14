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
import { LoadMode, MAX_TEAM_SIZE, StoneColor, STONE_COLORS, STONES, stoneKind, Team } from '../../domain/model';
import { addWeeks, formatShort, isoWeek, parseIsoDate } from '../../domain/weeks';
import { PlanningStore } from '../../state/planning.store';
import { CELL_H, ViewService } from '../../state/view.service';
import { Icon } from '../icon';

const PREVIEW_MAX_W = 250;
const PREVIEW_MAX_H = 150;

/** Là où le nouveau projet ira : un vase, ou le bac commun (`team = null`). */
interface Destination {
  team: Team | null;
  name: string;
  /** Borne du nombre de personnes : l'effectif, ou l'effectif maximal pour le bac commun. */
  size: number;
}

/**
 * Fenêtre « Nouveau caillou » : on saisit la charge et le nombre de personnes,
 * et l'aperçu montre tout de suite la forme de la brique et si elle tient dans le vase.
 * Ouverte depuis le dock, elle crée le projet dans le bac commun, sans le poser.
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

  protected readonly target = computed<Destination | null>(() => {
    const request = this.view.newProjectFor();
    if (!request) return null;
    if (request.teamId === null) return { team: null, name: 'Bac commun', size: MAX_TEAM_SIZE };
    const team = this.store.team(request.teamId);
    return team ? { team, name: team.name, size: team.size } : null;
  });
  protected readonly team = computed(() => this.target()?.team ?? null);

  // Chaque champ du formulaire est un signal, lié en double sens avec [(ngModel)].
  protected readonly name = signal('');
  protected readonly charge = signal(20);
  protected readonly persons = signal(1);
  protected readonly mode = signal<LoadMode>('free');
  protected readonly color = signal<StoneColor>('terracotta');

  protected readonly dims = computed(() => {
    const size = this.target()?.size ?? 1;
    return initialDims(this.charge() > 0 ? this.charge() : 1, Math.min(this.persons(), size));
  });
  protected readonly kind = computed(() => stoneKind(this.dims().charge));

  protected readonly windowWeeks = computed(() => this.store.window().weeks);

  /** Où la brique tomberait si on la déposait maintenant (à partir de la semaine en cours). */
  protected readonly landing = computed(() => {
    const t = this.team();
    if (!t) return null;
    const cell = findFirstFit(this.dims(), this.store.occupancy(t.id), Math.max(0, this.store.todayCol()));
    if (!cell) return null;
    const monday = parseIsoDate(addWeeks(this.store.windowStart(), cell.col));
    return { ...cell, label: `S${isoWeek(monday)}, ${formatShort(monday)}` };
  });

  /** Semaines à ajouter à la fenêtre pour que le projet tienne, quand il ne tient pas. */
  protected readonly extension = computed(() => {
    const t = this.team();
    if (!t || this.landing()) return null;
    return this.store.extensionFor(t.id, this.dims());
  });

  /** Les briques de l'équipe dans la fenêtre, coupées à ses bords. */
  protected readonly placed = computed(() => {
    const t = this.team();
    if (!t) return [];
    const W = this.windowWeeks();
    return this.store
      .projectsOf(t.id)
      .map((p) => this.store.windowRect(p))
      .filter((r): r is Rect => r !== null)
      .map((r) => ({ ...r, col: Math.max(0, r.col), weeks: Math.min(W, r.col + r.weeks) - Math.max(0, r.col) }))
      .filter((r) => r.weeks > 0);
  });

  /** Le vase miniature garde les proportions du vrai. */
  protected readonly preview = computed(() => {
    const t = this.team();
    if (!t) return { w: 0, h: 0 };
    const w = this.windowWeeks() * this.view.cellW();
    const h = t.size * CELL_H;
    const scale = Math.min(PREVIEW_MAX_W / w, PREVIEW_MAX_H / h);
    return { w: w * scale, h: h * scale };
  });

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // Réinitialise le formulaire à chaque ouverture, avec toute l'équipe en parallèle par défaut
    // (une seule personne pour le bac commun, qui n'a pas d'effectif).
    effect(() => {
      const t = this.target();
      if (!t) return;
      untracked(() => {
        this.name.set('');
        this.charge.set(20);
        this.persons.set(t.team ? t.size : 1);
        this.mode.set('free');
        this.color.set(this.store.nextColor(t.team?.id ?? null));
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

  /** `extend` : allonger la fenêtre juste assez pour que le projet tienne, plutôt que de le mettre au bac. */
  protected create(extend = false): void {
    const t = this.target();
    if (!t || !(this.charge() > 0)) return;
    const draft = {
      name: this.name(),
      charge: this.charge(),
      persons: this.persons(),
      mode: this.mode(),
      color: this.color(),
    };
    this.store.addProject(t.team?.id ?? null, draft, extend);
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
