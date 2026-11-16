import { DecimalPipe } from '@angular/common';
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
import { MAX_TEAM_SIZE, Project } from '../../domain/model';
import {
  LineStatus,
  Outcome,
  PlanAction,
  PlanLine,
  PlanningChoices,
  reviewPlanning,
  Target,
  TeamPlan,
} from '../../domain/planning-review';
import { addWeeks, formatShort, parseIsoDate } from '../../domain/weeks';
import { PlanningStore } from '../../state/planning.store';
import { ViewService } from '../../state/view.service';
import { Icon } from '../icon';

const STATUS_LABELS: Record<LineStatus, string> = {
  new: 'Nouveau',
  toPlace: 'À poser',
  upToDate: 'À jour',
  drift: 'Écart',
  unplanned: 'Non planifié',
  ended: 'Sans suite',
};

/** Les mêmes états, au pluriel, pour les compteurs de l'en-tête. */
const TALLY_PLURALS: Record<LineStatus, string> = {
  new: 'nouveaux',
  toPlace: 'à poser',
  upToDate: 'à jour',
  drift: 'écarts',
  unplanned: 'non planifiés',
  ended: 'sans suite',
};

const ACTION_LABELS: Record<PlanAction, string> = {
  place: 'Poser à sa date',
  toTray: "Bac de l'équipe",
  align: 'Aligner sur le JSON',
  none: 'Ne rien faire',
};

/**
 * Aperçu de comparaison avec un export de planification. Comme l'aperçu Excel, il ne garde que
 * les choix de l'utilisateur (effectifs des équipes à créer, actions qui diffèrent du défaut) ;
 * `reviewPlanning` recalcule tout, simulation des poses comprise. « Appliquer » transmet cette
 * même revue au store : l'aperçu montre exactement ce qui sera fait.
 */
@Component({
  selector: 'app-planning-dialog',
  imports: [DecimalPipe, Icon],
  templateUrl: './planning-dialog.html',
  styleUrl: './planning-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanningDialog {
  protected readonly store = inject(PlanningStore);
  protected readonly view = inject(ViewService);
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly actionLabels = ACTION_LABELS;
  protected readonly maxTeamSize = MAX_TEAM_SIZE;

  protected readonly source = this.view.planningSource;

  private readonly teamSizes = signal<ReadonlyMap<string, number>>(new Map());
  private readonly actions = signal<ReadonlyMap<string, PlanAction>>(new Map());

  protected readonly review = computed(() => {
    const source = this.source();
    if (!source) return null;
    const state = {
      window: this.store.window(),
      teams: this.store.teams(),
      projects: this.store.projects(),
    };
    const choices: PlanningChoices = { teamSizes: this.teamSizes(), actions: this.actions() };
    return reviewPlanning(source.export, state, this.store.today, choices);
  });

  /** Nombre de projets dans chaque état, pour l'en-tête. */
  protected readonly tally = computed(() => {
    const counts = new Map<LineStatus, number>();
    for (const line of this.review()?.lines ?? [])
      counts.set(line.status, (counts.get(line.status) ?? 0) + 1);
    return (Object.keys(STATUS_LABELS) as LineStatus[])
      .filter((s) => counts.has(s))
      .map((s) => {
        const count = counts.get(s)!;
        return {
          status: s,
          count,
          label: count > 1 ? TALLY_PLURALS[s] : STATUS_LABELS[s].toLowerCase(),
        };
      });
  });

  protected readonly absentCount = computed(() =>
    (this.review()?.teams ?? []).reduce((n, t) => n + t.absent.length, 0),
  );

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // Chaque ouverture repart de zéro.
    effect(() => {
      if (!this.source()) return;
      untracked(() => {
        this.teamSizes.set(new Map());
        this.actions.set(new Map());
      });
    });
    afterRenderEffect(() => {
      const el = this.dialog()?.nativeElement;
      if (el && !el.open) el.showModal();
    });
  }

  protected setSize(team: TeamPlan, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.teamSizes.update((map) => {
      const next = new Map(map);
      if (Number.isInteger(value) && value >= 1 && value <= MAX_TEAM_SIZE)
        next.set(team.key, value);
      else next.delete(team.key);
      return next;
    });
  }

  protected setAction(line: PlanLine, event: Event): void {
    const action = (event.target as HTMLSelectElement).value as PlanAction;
    this.actions.update((map) => new Map(map).set(line.key, action));
  }

  /** « 16 nov. → 28 déc. · 7 sem. · 6 j/h » */
  protected describeTarget(t: Target): string {
    const end = addWeeks(t.start, t.weeks - 1);
    return `${this.date(t.start)} → ${this.date(end)} · ${t.weeks} sem. · ${this.num(t.charge)} j/h`;
  }

  /** Où est le projet dans Cailloux, pour un projet en écart. */
  protected describeCurrent(p: Project): string {
    const team = this.store.team(p.teamId)?.name ?? 'bac commun';
    if (p.start === null) return `dans le bac (${team}) · ${this.num(p.charge)} j/h`;
    const end = addWeeks(p.start, p.weeks - 1);
    return `${team} · ${this.date(p.start)} → ${this.date(end)} · ${p.weeks} sem. · ${this.num(p.charge)} j/h`;
  }

  protected describeOutcome(o: Outcome): string {
    switch (o.kind) {
      case 'placed':
        return `ligne ${o.row + 1}`;
      case 'tray':
        return "au bac de l'équipe";
      case 'unchanged':
        return 'pas de place : reste où il est';
      case 'pending':
        return 'effectif à saisir';
      default:
        return '';
    }
  }

  protected apply(): void {
    const review = this.review();
    if (!review || !review.ready || review.summary.actions === 0) return;
    this.store.applyPlanning(review);
    this.close();
  }

  protected close(): void {
    this.dialog()?.nativeElement.close();
    // On n'attend pas l'événement `close` : le navigateur peut le retarder (page en arrière-plan).
    // Il reste utile pour la touche Échap, et un second appel est sans effet.
    this.onClosed();
  }

  /** Fermeture par un bouton, par Échap ou après l'application. */
  protected onClosed(): void {
    this.view.planningSource.set(null);
  }

  private date(iso: string): string {
    return formatShort(parseIsoDate(iso));
  }

  private num(n: number): string {
    return String(Math.round(n * 10) / 10).replace('.', ',');
  }
}
