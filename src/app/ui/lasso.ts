import { WritableSignal } from '@angular/core';
import { PlanningStore } from '../state/planning.store';

export interface LassoRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface LassoOptions {
  event: PointerEvent;
  container: HTMLElement;
  itemSelector: string;
  idAttr: string;
  rectSignal: WritableSignal<LassoRect | null>;
  store: PlanningStore;
  onEmptyClick?: () => void;
}

const LASSO_THRESHOLD_PX = 4;

/**
 * Lance une sélection au lasso (rectangle de sélection) depuis un `pointerdown` sur un fond vide.
 * Si le pointeur ne dépasse pas le seuil de déplacement, exécute un simple clic de désélection.
 */
export function startLasso(opts: LassoOptions): void {
  const { event, container, itemSelector, idAttr, rectSignal, store, onEmptyClick } = opts;
  if (event.button !== 0) return;

  const start = { x: event.clientX, y: event.clientY };
  const additive = event.ctrlKey || event.metaKey || event.shiftKey;
  const initialIds = additive ? new Set(store.selectedIds()) : new Set<string>();
  let active = false;

  const move = (e: PointerEvent) => {
    if (!active) {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < LASSO_THRESHOLD_PX) return;
      active = true;
      document.body.classList.add('is-selecting');
    }
    const left = Math.min(start.x, e.clientX);
    const top = Math.min(start.y, e.clientY);
    const right = Math.max(start.x, e.clientX);
    const bottom = Math.max(start.y, e.clientY);
    rectSignal.set({ left, top, width: right - left, height: bottom - top });

    const next = new Set(initialIds);
    for (const el of container.querySelectorAll<HTMLElement>(itemSelector)) {
      const id = el.dataset[idAttr];
      if (!id) continue;
      const r = el.getBoundingClientRect();
      if (r.left < right && r.right > left && r.top < bottom && r.bottom > top) {
        next.add(id);
      }
    }
    store.selectMany([...next]);
  };

  const cleanup = () => {
    document.body.classList.remove('is-selecting');
    rectSignal.set(null);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', key);
  };

  const up = () => {
    cleanup();
    if (!active) {
      if (onEmptyClick) onEmptyClick();
      else if (!additive) store.select(null);
    }
  };

  const cancel = () => {
    const wasActive = active;
    cleanup();
    if (wasActive) store.selectMany([...initialIds]);
  };

  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') cancel();
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('keydown', key);
}
