import { DecimalPipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { findNameColumn } from '../../domain/import';
import { parsePlanningExport } from '../../domain/planning-export';
import { Project } from '../../domain/model';
import { commonWaiting, periodFigures } from '../../domain/period';
import { DragService } from '../../state/drag.service';
import { PlanningStore } from '../../state/planning.store';
import { readFirstSheet, XlsxError } from '../../io/xlsx';
import { ToastService } from '../../state/toast.service';
import { ViewService } from '../../state/view.service';
import { Brick } from '../brick/brick';
import { Icon } from '../icon';
import { startLasso } from '../lasso';

/** Écart entre le bas du dock et le bas de l'écran (`bottom` dans `dock.scss`), plus une marge. */
const DOCK_MARGIN_PX = 20;
/**
 * Taille des gélules du dock. Elles doivent d'abord être lisibles (deux lignes de nom et la charge) :
 * la largeur ne croît qu'avec la racine carrée de la durée, et la hauteur à peine avec les personnes.
 * Un projet de 2 semaines fait ainsi 141 px de large, un de 24 semaines 218 px (et non 12 fois plus).
 */
const PILL_W_BASE = 110;
const PILL_W_PER_SQRT_WEEK = 22;
const PILL_W_MAX = 230;
const PILL_H = 58;
const PILL_H_PER_PERSON = 4;
const PILL_H_MAX = 72;

/**
 * Le dock du bac commun (ADR 0003) : fixé en bas de l'écran, visible quel que soit le défilement.
 * En mode Vases, c'est une zone de dépôt (`data-drop-kind="common"`) et ses briques se glissent vers
 * les vases ; sur l'Étagère, il est en lecture seule.
 *
 * On y importe aussi un fichier `.xlsx` (bouton « Importer… » ou dépôt d'un fichier venu de
 * l'explorateur). Ce dépôt passe par les événements natifs `dragover`/`drop`, distincts des
 * Pointer Events du `DragService` : les deux mécanismes ne se croisent pas.
 */
@Component({
  selector: 'app-dock',
  imports: [Brick, Icon, DecimalPipe],
  templateUrl: './dock.html',
  styleUrl: './dock.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.height.px]': 'reserved()',
    '(window:dragover)': 'guard($event)',
    '(window:drop)': 'guard($event)',
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
  },
})
export class Dock {
  protected readonly store = inject(PlanningStore);
  protected readonly view = inject(ViewService);
  protected readonly dnd = inject(DragService);
  private readonly toast = inject(ToastService);

  private readonly hostEl = inject<ElementRef<HTMLElement>>(ElementRef);
  private lastAnchorId: string | null = null;

  /** Les gros cailloux d'abord. */
  protected readonly projects = computed(() => [...this.store.commonProjects()].sort((a, b) => b.charge - a.charge));
  protected readonly selectedProjects = computed(() => {
    const ids = this.store.selectedIds();
    return this.store.projects().filter((p) => ids.has(p.id));
  });
  protected readonly selectedCharge = computed(() => this.selectedProjects().reduce((sum, p) => sum + p.charge, 0));
  protected readonly multiActive = computed(() => this.selectedProjects().length >= 2);
  protected readonly hasTeamProjects = computed(() => this.selectedProjects().some((p) => p.teamId !== null));
  protected readonly teamMenu = signal<'place' | 'tray' | null>(null);
  protected readonly teamChoices = computed(() => {
    const period = this.view.period();
    const needed = this.selectedCharge();
    return this.store.teams().map((t) => {
      const fig = periodFigures(t.size, this.store.projectsOf(t.id), period);
      return { team: t, remaining: fig.remaining, fits: fig.remaining >= needed };
    });
  });
  protected readonly waiting = computed(() => {
    const period = this.view.period();
    const teams = this.store.teams().map((t) => periodFigures(t.size, this.store.projectsOf(t.id), period));
    return commonWaiting(this.store.projects(), teams);
  });
  /** Hauteur réelle du dock, mesurée : elle suit le nombre de rangées de briques. */
  private readonly dockHeight = signal(52);
  /** Hauteur réservée en bas de page pour que le dock ne masque pas le dernier vase. */
  protected readonly reserved = computed(() => this.dockHeight() + DOCK_MARGIN_PX);

  protected readonly draggingIds = computed(() => new Set(this.dnd.drag()?.projects.map((p) => p.id) ?? []));
  /** Une brique d'équipe survole le dock : il s'allume pour montrer qu'on peut l'y lâcher. */
  protected readonly active = computed(() => this.dnd.drag()?.target?.kind === 'common');
  /** Un fichier de l'explorateur survole le dock. */
  protected readonly fileOver = signal(false);

  constructor() {
    // Les toasts se posent juste au-dessus du dock.
    effect(() => document.documentElement.style.setProperty('--dock-h', `${this.reserved()}px`));

    // Le dock est en position fixe : il ne pousse pas la page. On mesure sa hauteur (qui dépend du
    // nombre de rangées, du repli et de la largeur de l'écran) pour réserver la même place en bas.
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const dock = host.nativeElement.querySelector('aside');
      if (!dock) return;
      const observer = new ResizeObserver(() => this.dockHeight.set(Math.ceil(dock.getBoundingClientRect().height)));
      observer.observe(dock);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected miniSize(p: Project): { w: number; h: number } {
    return {
      w: Math.min(PILL_W_MAX, Math.round(PILL_W_BASE + PILL_W_PER_SQRT_WEEK * Math.sqrt(p.weeks))),
      h: Math.min(PILL_H_MAX, PILL_H + (p.persons - 1) * PILL_H_PER_PERSON),
    };
  }

  protected onItemsPointerDown(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest('.dock-item')) return;
    startLasso({
      event,
      container: event.currentTarget as HTMLElement,
      itemSelector: '.dock-item',
      idAttr: 'lassoId',
      rectSignal: this.view.lasso,
      store: this.store,
    });
  }

  protected isSelected(id: string): boolean {
    return this.store.selectedIds().has(id);
  }

  protected press(event: PointerEvent, p: Project): void {
    if (event.button !== 0) return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      this.toggleWithAnchor(p.id);
      return;
    }
    if (event.shiftKey) {
      event.preventDefault();
      this.selectRangeTo(p.id);
      return;
    }
    this.lastAnchorId = p.id;
    this.dnd.press(event, p, 0, true);
  }

  protected togglePick(event: MouseEvent, p: Project): void {
    event.stopPropagation();
    if (event.shiftKey) {
      this.selectRangeTo(p.id);
      return;
    }
    this.toggleWithAnchor(p.id);
  }

  protected onDockKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select')) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      const ids = this.projects().map((p) => p.id);
      if (!ids.length) return;
      event.preventDefault();
      this.store.selectMany(ids);
      this.lastAnchorId = ids[0];
    }
  }

  protected toggleMenu(kind: 'place' | 'tray'): void {
    this.teamMenu.update((cur) => (cur === kind ? null : kind));
  }

  protected moveSelectedTo(teamId: string): void {
    const mode = this.teamMenu();
    if (!mode) return;
    const ids = this.selectedProjects().map((p) => p.id);
    this.teamMenu.set(null);
    this.store.moveProjectsToTeam(ids, teamId, mode);
  }

  protected moveSelectedToCommon(): void {
    const ids = this.selectedProjects().map((p) => p.id);
    this.teamMenu.set(null);
    this.store.moveProjectsToCommon(ids);
  }

  protected deleteSelected(): void {
    const ids = this.selectedProjects().map((p) => p.id);
    this.teamMenu.set(null);
    if (ids.length > 0) this.view.confirmDeleteProjectIds.set(ids);
  }

  protected clearSelection(): void {
    this.teamMenu.set(null);
    this.store.select(null);
  }

  protected onDocumentPointerDown(event: PointerEvent): void {
    if (!this.teamMenu()) return;
    const bar = this.hostEl.nativeElement.querySelector('.batch-bar');
    if (bar && !bar.contains(event.target as Node)) {
      this.teamMenu.set(null);
    }
  }

  private toggleWithAnchor(id: string): void {
    this.store.toggleSelect(id);
    this.lastAnchorId = id;
  }

  private selectRangeTo(targetId: string): void {
    const list = this.projects();
    const toIdx = list.findIndex((p) => p.id === targetId);
    if (toIdx === -1) return;
    const anchorIdx = this.lastAnchorId ? list.findIndex((p) => p.id === this.lastAnchorId) : -1;
    const fromIdx = anchorIdx === -1 ? 0 : anchorIdx;
    const [start, end] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
    const merged = new Set(this.store.selectedIds());
    for (const p of list.slice(start, end + 1)) merged.add(p.id);
    this.store.selectMany([...merged]);
    if (!this.lastAnchorId) this.lastAnchorId = list[fromIdx].id;
  }

  protected openDetails(p: Project): void {
    this.view.openInspector(p.id);
  }

  // ---------------------------------------------------------------- Import de fichier

  protected onFileOver(event: DragEvent): void {
    if (!hasFiles(event)) return;
    // Sans preventDefault(), le navigateur refuse le dépôt.
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'copy';
    this.fileOver.set(true);
  }

  protected onFileLeave(event: DragEvent): void {
    // `dragleave` part aussi quand on passe sur un enfant du dock : on ne s'éteint qu'en le quittant.
    const dock = event.currentTarget as HTMLElement;
    if (!dock.contains(event.relatedTarget as Node | null)) this.fileOver.set(false);
  }

  protected onFileDrop(event: DragEvent): void {
    this.fileOver.set(false);
    if (!hasFiles(event)) return;
    event.preventDefault();
    const file = event.dataTransfer!.files[0];
    if (file) void this.open(file);
  }

  protected onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Remis à vide pour pouvoir choisir deux fois de suite le même fichier.
    input.value = '';
    if (file) void this.open(file);
  }

  /**
   * Un fichier lâché à côté du dock serait ouvert par le navigateur, qui quitterait l'application.
   * Le dock, s'il accepte le dépôt, a déjà appelé preventDefault() : on ne touche alors à rien.
   */
  protected guard(event: DragEvent): void {
    if (!hasFiles(event) || event.defaultPrevented) return;
    event.preventDefault();
    if (event.type === 'dragover') event.dataTransfer!.dropEffect = 'none';
  }

  private async open(file: File): Promise<void> {
    if (file.name.toLowerCase().endsWith('.json')) return this.openPlanning(file);
    let table: string[][];
    try {
      table = await readFirstSheet(await file.arrayBuffer());
    } catch (e) {
      this.toast.show(e instanceof XlsxError ? e.message : `« ${file.name} » n'a pas pu être lu.`);
      return;
    }
    if (findNameColumn(table[0] ?? []) === null) {
      this.toast.show('Aucune colonne de nom (« Nom Projet » ou « Nom ») dans la première feuille du fichier.');
      return;
    }
    if (table.length < 2) {
      this.toast.show('Le fichier ne contient aucun projet.');
      return;
    }
    this.view.importSource.set({ fileName: file.name, table });
  }

  /** Un export JSON de planification : on le lit, puis l'aperçu de comparaison s'ouvre. */
  private async openPlanning(file: File): Promise<void> {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      this.toast.show(`« ${file.name} » n'a pas pu être lu : ce n'est pas un fichier JSON valide.`);
      return;
    }
    const planning = parsePlanningExport(data);
    if (!planning) {
      this.toast.show(`« ${file.name} » n'est pas un export de planification (listes « projets » et « equipes » attendues).`);
      return;
    }
    this.view.planningSource.set({ fileName: file.name, export: planning });
  }
}

function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false;
}
