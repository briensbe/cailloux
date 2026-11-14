import { afterNextRender, inject, Injectable, Injector, signal } from '@angular/core';
import { Dims, fitToTeam } from '../domain/capacity';
import { Cell, findNearestFree } from '../domain/geometry';
import { Project } from '../domain/model';
import { PlanningStore } from './planning.store';
import { CELL_H, ViewService } from './view.service';

/**
 * Où la brique atterrira : une case d'un vase (avec la forme qu'elle y prendra, recalée à l'effectif
 * si elle est trop haute), le bac d'une équipe, ou le bac commun (le dock).
 */
export type DropTarget =
  | { kind: 'grid'; teamId: string; cell: Cell; dims: Dims }
  | { kind: 'tray'; teamId: string }
  | { kind: 'common' };

export interface DragState {
  project: Project;
  /** Où l'on a « attrapé » la brique, en pixels depuis son coin haut-gauche (à taille réelle). */
  grab: { x: number; y: number };
  pointer: { x: number; y: number };
  /** Là où la brique atterrira si on la lâche maintenant (`null` = retour à sa place). */
  target: DropTarget | null;
}

/** En dessous de cette distance, un appui est un simple clic (sélection), pas un glisser. */
const DRAG_THRESHOLD_PX = 4;
const AUTOSCROLL_EDGE_PX = 70;
const LANDING_MS = 420;

/**
 * Glisser-déposer des briques, d'un vase à l'autre ou vers un bac d'attente.
 *
 * On n'utilise pas le drag & drop HTML5 (impossible à styler, pas d'aimantation) ni le CDK
 * (pensé pour des listes) : on suit directement les Pointer Events, qui unifient souris,
 * stylet et tactile. Pendant le glisser, une copie flottante suit le curseur
 * (cf. DragOverlay) et chaque vase affiche un « fantôme » là où la brique va s'aimanter.
 */
@Injectable({ providedIn: 'root' })
export class DragService {
  private readonly store = inject(PlanningStore);
  private readonly view = inject(ViewService);
  private readonly injector = inject(Injector);

  readonly drag = signal<DragState | null>(null);
  /** Brique qui vient d'être lâchée : ses transitions CSS sont coupées pendant l'atterrissage. */
  readonly landing = signal<string | null>(null);

  /**
   * Appelé au `pointerdown` sur une brique.
   * `hiddenWeeks` : semaines coupées par le bord gauche de la fenêtre (projet déjà commencé).
   * `mini` : la brique est une miniature du bac d'attente.
   */
  press(event: PointerEvent, project: Project, hiddenWeeks = 0, mini = false): void {
    if (event.button !== 0) return;
    event.preventDefault();
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY };
    let started = false;

    const move = (e: PointerEvent) => {
      if (!started) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_THRESHOLD_PX) return;
        started = true;
        document.body.classList.add('is-dragging');
        // Les briques du bac sont en miniature : on ramène le point de prise à la taille réelle.
        // Une brique coupée à gauche n'en montre que la fin : on rajoute la partie cachée.
        const cellW = this.view.cellW();
        const grab = mini
          ? {
              x: ((start.x - box.left) / box.width) * project.weeks * cellW,
              y: ((start.y - box.top) / box.height) * project.persons * CELL_H,
            }
          : { x: start.x - box.left + hiddenWeeks * cellW, y: start.y - box.top };
        this.drag.set({ project, grab, pointer: start, target: null });
      }
      const d = this.drag()!;
      const pointer = { x: e.clientX, y: e.clientY };
      this.drag.set({ ...d, pointer, target: this.targetAt(pointer, d) });
      this.autoScroll(e.clientY);
    };
    const up = () => {
      cleanup();
      if (started) this.drop();
      else this.store.select(project.id);
    };
    const cancel = () => {
      cleanup();
      this.drag.set(null);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && cancel();
    const cleanup = () => {
      document.body.classList.remove('is-dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
  }

  /** Traduit la position du curseur en case du vase survolé, puis applique l'aimant. */
  private targetAt(pointer: { x: number; y: number }, d: DragState): DropTarget | null {
    const zone = document
      .elementFromPoint(pointer.x, pointer.y)
      ?.closest<HTMLElement>('[data-drop-team], [data-drop-kind="common"]');
    if (!zone) return null;
    if (zone.dataset['dropKind'] === 'common') return d.project.teamId === null ? null : { kind: 'common' };
    const teamId = zone.dataset['dropTeam'];
    const team = this.store.team(teamId ?? null);
    if (!teamId || !team) return null;
    if (zone.dataset['dropKind'] === 'tray') return { kind: 'tray', teamId };

    const grid = zone.querySelector<HTMLElement>('[data-grid]');
    if (!grid) return null;
    const box = grid.getBoundingClientRect();
    const { project: p, grab } = d;
    // Dans un vase trop étroit, la brique y entre ramenée à l'effectif : on cherche une place pour cette forme-là.
    const dims = fitToTeam(p, team.size);
    const left = pointer.x - grab.x;
    const bottom = pointer.y - grab.y + p.persons * CELL_H;
    // Les lignes se comptent depuis le fond du vase : on part du bas de la grille.
    const desired = {
      col: Math.round((left - box.left) / this.view.cellW()),
      row: Math.round((box.bottom - bottom) / CELL_H),
    };
    // Un projet déjà commencé peut garder une partie avant le bord gauche : si la place visée
    // est libre, on la prend telle quelle (l'aimant, lui, ne propose que des places visibles).
    const exact = { ...desired, weeks: dims.weeks, persons: dims.persons };
    if (desired.col < 0 && this.store.canOccupy(teamId, p.id, exact)) {
      return { kind: 'grid', teamId, cell: desired, dims };
    }
    const cell = findNearestFree(desired, dims, this.store.occupancy(teamId, p.id));
    return cell ? { kind: 'grid', teamId, cell, dims } : null;
  }

  private drop(): void {
    const d = this.drag();
    this.drag.set(null);
    if (!d?.target) return;
    const { project: p, target } = d;
    if (target.kind === 'tray') {
      this.store.moveProject(p.id, target.teamId, null);
      return;
    }
    if (target.kind === 'common') {
      this.store.moveProject(p.id, null, null);
      return;
    }
    const from = { x: d.pointer.x - d.grab.x, y: d.pointer.y - d.grab.y };
    this.landing.set(p.id);
    this.store.moveProject(p.id, target.teamId, target.cell);
    // Une fois la brique rendue à sa vraie place, on la fait partir de là où on l'a lâchée.
    afterNextRender(() => this.land(p.id, from), { injector: this.injector });
  }

  /**
   * Technique « FLIP » (First, Last, Invert, Play) : la brique est déjà à sa position finale,
   * on lui applique une translation qui la ramène sous le curseur, puis on anime vers zéro.
   * La courbe dépasse légèrement sa cible : c'est le petit « clac » de l'aimant.
   */
  private land(id: string, from: { x: number; y: number }): void {
    const el = document.querySelector<HTMLElement>(`[data-brick-id="${id}"]`);
    if (!el) {
      this.landing.set(null);
      return;
    }
    const to = el.getBoundingClientRect();
    el.animate(
      [
        { transform: `translate(${from.x - to.left}px, ${from.y - to.top}px) rotate(-2deg) scale(1.04)` },
        { transform: 'none' },
      ],
      { duration: LANDING_MS, easing: 'cubic-bezier(.2, 1.35, .35, 1)' },
    );
    // Minuterie plutôt qu'`onfinish` : ce dernier n'est jamais émis si l'onglet passe en arrière-plan.
    setTimeout(() => this.landing.update((v) => (v === id ? null : v)), LANDING_MS + 50);
  }

  /** Le bas de l'écran est occupé par le dock du bac commun : on fait défiler juste au-dessus. */
  private autoScroll(y: number): void {
    const dock = document.querySelector<HTMLElement>('[data-drop-kind="common"]');
    const bottom = dock ? dock.getBoundingClientRect().top : window.innerHeight;
    if (y < AUTOSCROLL_EDGE_PX) window.scrollBy(0, -14);
    else if (y > bottom - AUTOSCROLL_EDGE_PX && y < bottom) window.scrollBy(0, 14);
  }
}
