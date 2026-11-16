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
import {
  DEFAULT_IMPORT_CHARGE,
  ImportChoices,
  importDrafts,
  ImportLine,
  LineOverride,
  LineState,
  reviewImport,
  toggleStatus,
} from '../../domain/import';
import { STONES } from '../../domain/model';
import { commonWaiting, periodFigures } from '../../domain/period';
import { PlanningStore } from '../../state/planning.store';
import { ViewService } from '../../state/view.service';
import { Icon } from '../icon';

const STATE_LABELS: Record<LineState, string> = {
  new: 'Nouveau',
  existing: 'Déjà présent',
  duplicate: 'Doublon dans le fichier',
  ignored: 'Ignoré (sans nom)',
};

/**
 * Aperçu d'un import vers le bac commun. Le composant ne garde que les choix de l'utilisateur
 * (charge par défaut, statuts écartés, modifications ligne par ligne) ; tout le reste vient de
 * `reviewImport`, recalculé à chaque choix. Rien n'est écrit dans le planning avant « Importer ».
 */
@Component({
  selector: 'app-import-dialog',
  imports: [DecimalPipe, Icon],
  templateUrl: './import-dialog.html',
  styleUrl: './import-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportDialog {
  protected readonly store = inject(PlanningStore);
  protected readonly view = inject(ViewService);
  protected readonly stones = STONES;
  protected readonly stateLabels = STATE_LABELS;

  protected readonly source = this.view.importSource;

  private readonly defaultCharge = signal(DEFAULT_IMPORT_CHARGE);
  private readonly excluded = signal<ReadonlySet<string>>(new Set());
  private readonly overrides = signal<ReadonlyMap<number, LineOverride>>(new Map());
  /** La rotation des pierres repart du nombre de projets du bac commun à l'ouverture. */
  private readonly firstColorIndex = signal(0);

  private readonly choices = computed<ImportChoices>(() => ({
    defaultCharge: this.defaultCharge(),
    excludedStatuses: this.excluded(),
    overrides: this.overrides(),
  }));

  protected readonly review = computed(() => {
    const source = this.source();
    if (!source) return null;
    return reviewImport(
      source.table,
      this.store.projects(),
      this.choices(),
      this.firstColorIndex(),
    );
  });

  /** Nombre de lignes dans chaque état, pour le résumé de l'en-tête. */
  protected readonly tally = computed(() => {
    const counts: Record<LineState, number> = { new: 0, existing: 0, duplicate: 0, ignored: 0 };
    for (const line of this.review()?.lines ?? []) counts[line.state]++;
    return counts;
  });

  /** La charge importée, ajoutée au bac commun, tiendrait-elle dans la capacité restante de toutes les équipes ? */
  protected readonly waiting = computed(() => {
    const period = this.view.period();
    const teams = this.store
      .teams()
      .map((t) => periodFigures(t.size, this.store.projectsOf(t.id), period));
    const now = commonWaiting(this.store.projects(), teams);
    const charge = now.charge + (this.review()?.charge ?? 0);
    return { remaining: now.remaining, fits: charge <= now.remaining };
  });

  protected readonly displayedDefault = this.defaultCharge.asReadonly();
  protected readonly isExcluded = (status: string) => this.excluded().has(status);

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // Chaque ouverture repart de zéro.
    effect(() => {
      if (!this.source()) return;
      untracked(() => {
        this.defaultCharge.set(DEFAULT_IMPORT_CHARGE);
        this.excluded.set(new Set());
        this.overrides.set(new Map());
        this.firstColorIndex.set(this.store.commonProjects().length);
      });
    });
    afterRenderEffect(() => {
      const el = this.dialog()?.nativeElement;
      if (el && !el.open) el.showModal();
    });
  }

  protected setDefaultCharge(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.defaultCharge.set(value > 0 ? value : DEFAULT_IMPORT_CHARGE);
  }

  protected toggleStatus(status: string): void {
    const review = this.review();
    if (!review) return;
    const next = toggleStatus(this.choices(), review, status);
    this.excluded.set(next.excludedStatuses);
    this.overrides.set(next.overrides);
  }

  protected check(line: ImportLine, event: Event): void {
    this.patch(line, { checked: (event.target as HTMLInputElement).checked });
  }

  protected rename(line: ImportLine, event: Event): void {
    this.patch(line, { name: (event.target as HTMLInputElement).value });
  }

  /** Une charge vide ou invalide rend la ligne à la charge par défaut. */
  protected setCharge(line: ImportLine, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.patch(line, { charge: value > 0 ? value : undefined });
  }

  protected import(): void {
    const review = this.review();
    if (!review || review.count === 0) return;
    this.store.importProjects(importDrafts(review));
    this.close();
  }

  protected close(): void {
    this.dialog()?.nativeElement.close();
  }

  /** Fermeture par un bouton, par Échap ou après l'import. */
  protected onClosed(): void {
    this.view.importSource.set(null);
  }

  private patch(line: ImportLine, change: LineOverride): void {
    this.overrides.update((map) => {
      const next = new Map(map);
      next.set(line.index, { ...map.get(line.index), ...change });
      return next;
    });
  }
}
