import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Period, PERIOD_PRESETS, periodEndExclusive, PeriodPreset, presetPeriod } from '../domain/period';
import { addDays, formatShort, parseIsoDate } from '../domain/weeks';
import { PlanningStore } from './planning.store';

/** Hauteur d'une ligne du vase (une personne), en pixels. */
export const CELL_H = 44;

export const ZOOM_MIN = 12;
export const ZOOM_MAX = 110;

/** Largeur prise autour de la grille d'un vase (marges de la carte, axe des personnes, parois). */
const VASE_CHROME_PX = 150;
const FIT_MIN_PX = 6;

const VIEW_KEY = 'cailloux.view.v1';

interface StoredView {
  zoom: number;
  fit: boolean;
  period: PeriodPreset | 'custom';
  custom: Period | null;
}

/** État purement visuel : il n'entre pas dans l'historique d'annulation, mais il est retenu d'une visite à l'autre. */
@Injectable({ providedIn: 'root' })
export class ViewService {
  private readonly store = inject(PlanningStore);
  private readonly stored = readView();

  /** Zoom choisi au curseur : largeur d'une semaine en pixels. */
  readonly zoom = signal(this.stored.zoom);
  /** Mode « tout voir » : la fenêtre entière tient dans la largeur de l'écran. */
  readonly fit = signal(this.stored.fit);
  /** Largeur disponible pour les vases, mesurée par l'application. */
  readonly boardWidth = signal(0);

  /** Largeur d'une semaine en pixels, effectivement utilisée pour dessiner. */
  readonly cellW = computed(() => {
    if (!this.fit() || !this.boardWidth()) return this.zoom();
    const fitted = Math.floor((this.boardWidth() - VASE_CHROME_PX) / this.store.window().weeks);
    return Math.max(FIT_MIN_PX, Math.min(ZOOM_MAX, fitted));
  });

  readonly periodChoice = signal<PeriodPreset | 'custom'>(this.stored.period);
  private readonly custom = signal<Period | null>(this.stored.custom);
  /** La période d'analyse : prédéfinie (à partir de la semaine en cours) ou personnalisée. */
  readonly period = computed<Period>(() => {
    const choice = this.periodChoice();
    const custom = this.custom();
    if (choice === 'custom' && custom) return custom;
    return presetPeriod(choice === 'custom' ? '3m' : choice);
  });

  readonly periodLabel = computed(() => {
    const choice = this.periodChoice();
    const preset = PERIOD_PRESETS.find((p) => p.id === choice);
    if (preset) return `Sur ${preset.label}`;
    const period = this.period();
    const sunday = addDays(parseIsoDate(periodEndExclusive(period)), -1);
    return `Du ${formatShort(parseIsoDate(period.start))} au ${formatShort(sunday)}`;
  });

  /** Équipe pour laquelle la fenêtre « Nouveau caillou » est ouverte. */
  readonly newProjectFor = signal<string | null>(null);

  constructor() {
    effect(() => {
      const view: StoredView = {
        zoom: this.zoom(),
        fit: this.fit(),
        period: this.periodChoice(),
        custom: this.custom(),
      };
      try {
        localStorage.setItem(VIEW_KEY, JSON.stringify(view));
      } catch {
        // Stockage indisponible (navigation privée…) : l'affichage ne sera simplement pas retenu.
      }
    });
  }

  /** Toucher au zoom quitte le mode « tout voir ». */
  setZoom(px: number): void {
    this.zoom.set(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(px))));
    this.fit.set(false);
  }

  setCustomPeriod(period: Period): void {
    this.custom.set(period);
    this.periodChoice.set('custom');
  }
}

function readView(): StoredView {
  const fallback: StoredView = { zoom: 64, fit: false, period: '3m', custom: null };
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    if (!raw) return fallback;
    const view = { ...fallback, ...(JSON.parse(raw) as Partial<StoredView>) };
    if (!(view.zoom >= ZOOM_MIN && view.zoom <= ZOOM_MAX)) view.zoom = fallback.zoom;
    return view;
  } catch {
    return fallback;
  }
}
