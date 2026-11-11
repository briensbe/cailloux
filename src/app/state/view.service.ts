import { effect, Injectable, signal } from '@angular/core';

/** Hauteur d'une ligne du vase (une personne), en pixels. */
export const CELL_H = 44;

export const ZOOM_MIN = 36;
export const ZOOM_MAX = 110;

const ZOOM_KEY = 'cailloux.zoom';

/** État purement visuel : il n'entre pas dans l'historique d'annulation. */
@Injectable({ providedIn: 'root' })
export class ViewService {
  /** Largeur d'une semaine en pixels (le zoom horizontal). */
  readonly cellW = signal(readZoom());
  /** Équipe pour laquelle la fenêtre « Nouveau caillou » est ouverte. */
  readonly newProjectFor = signal<string | null>(null);

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(ZOOM_KEY, String(this.cellW()));
      } catch {
        // Stockage indisponible (navigation privée…) : le zoom ne sera simplement pas retenu.
      }
    });
  }
}

function readZoom(): number {
  try {
    const value = Number(localStorage.getItem(ZOOM_KEY));
    return value >= ZOOM_MIN && value <= ZOOM_MAX ? value : 64;
  } catch {
    return 64;
  }
}
