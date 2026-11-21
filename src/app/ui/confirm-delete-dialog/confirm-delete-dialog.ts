import { DecimalPipe } from '@angular/common';
import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, inject, viewChild } from '@angular/core';
import { STONES } from '../../domain/model';
import { PlanningStore } from '../../state/planning.store';
import { ViewService } from '../../state/view.service';
import { Icon } from '../icon';

/** Premier avertissement avant de retirer un ou plusieurs projets du planning. */
@Component({
  selector: 'app-confirm-delete-dialog',
  imports: [Icon, DecimalPipe],
  templateUrl: './confirm-delete-dialog.html',
  styleUrl: './confirm-delete-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDeleteDialog {
  private readonly store = inject(PlanningStore);
  private readonly view = inject(ViewService);

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly projects = computed(() => {
    const idSet = new Set(this.view.confirmDeleteProjectIds());
    if (idSet.size === 0) return [];
    return this.store.projects().filter((p) => idSet.has(p.id));
  });

  protected readonly single = computed(() => (this.projects().length === 1 ? this.projects()[0] : null));

  protected readonly totalCharge = computed(() =>
    this.projects().reduce((sum, p) => sum + p.charge, 0),
  );

  protected readonly team = computed(() => {
    const p = this.single();
    return p ? (this.store.team(p.teamId) ?? null) : null;
  });

  protected readonly stoneColor = computed(() => {
    const p = this.single();
    return p ? STONES[p.color].base : '#b4492b';
  });

  constructor() {
    afterRenderEffect(() => {
      const el = this.dialog()?.nativeElement;
      if (el && !el.open) el.showModal();
    });
  }

  protected confirm(): void {
    const ids = this.projects().map((p) => p.id);
    if (ids.length === 0) return;
    this.close();
    this.store.removeProjects(ids);
  }

  protected close(): void {
    this.dialog()?.nativeElement.close();
  }

  protected onClosed(): void {
    this.view.confirmDeleteProjectIds.set([]);
  }
}
