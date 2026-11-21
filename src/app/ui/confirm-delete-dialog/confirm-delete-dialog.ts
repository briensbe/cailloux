import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, inject, viewChild } from '@angular/core';
import { STONES } from '../../domain/model';
import { PlanningStore } from '../../state/planning.store';
import { ViewService } from '../../state/view.service';
import { Icon } from '../icon';

/** Premier avertissement avant de retirer un projet du planning. */
@Component({
  selector: 'app-confirm-delete-dialog',
  imports: [Icon],
  templateUrl: './confirm-delete-dialog.html',
  styleUrl: './confirm-delete-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDeleteDialog {
  private readonly store = inject(PlanningStore);
  private readonly view = inject(ViewService);

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly project = computed(() => {
    const id = this.view.confirmDeleteProjectId();
    return id ? (this.store.projects().find((p) => p.id === id) ?? null) : null;
  });

  protected readonly team = computed(() => {
    const p = this.project();
    return p ? (this.store.team(p.teamId) ?? null) : null;
  });

  protected readonly stoneColor = computed(() => {
    const p = this.project();
    return p ? STONES[p.color].base : '#b4492b';
  });

  constructor() {
    afterRenderEffect(() => {
      const el = this.dialog()?.nativeElement;
      if (el && !el.open) el.showModal();
    });
  }

  protected confirm(): void {
    const p = this.project();
    if (!p) return;
    this.close();
    this.store.removeProject(p.id);
  }

  protected close(): void {
    this.dialog()?.nativeElement.close();
  }

  protected onClosed(): void {
    this.view.confirmDeleteProjectId.set(null);
  }
}
