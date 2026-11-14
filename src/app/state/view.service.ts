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
/** Largeur prise autour des vases miniatures de l'Étagère (colonne d'en-têtes, marges de la carte). */
const SHELF_CHROME_PX = 270;
const SHELF_FIT_MIN_PX = 3;

/** Les deux façons de regarder le planning : vases détaillés, ou Étagère en lecture seule. */
export type ViewMode = 'vases' | 'etagere';

const VIEW_KEY = 'cailloux.view.v1';

interface StoredView {
  zoom: number;
  fit: boolean;
  period: PeriodPreset | 'custom';
  custom: Period | null;
  mode: ViewMode;
  shelfZoom: number;
  shelfFit: boolean;
  dockOpen: boolean;
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

  /** Mode d'affichage : retenu d'une visite à l'autre, hors de l'historique d'annulation. */
  readonly mode = signal<ViewMode>(this.stored.mode);
  /** Zoom propre à l'Étagère, pour que passer d'un mode à l'autre ne fasse pas sauter le zoom. */
  readonly shelfZoom = signal(this.stored.shelfZoom);
  readonly shelfFit = signal(this.stored.shelfFit);
  /** Le dock du bac commun est-il déplié ? */
  readonly dockOpen = signal(this.stored.dockOpen);

  /** Largeur d'une semaine sur l'Étagère, en pixels. */
  readonly shelfCellW = computed(() => {
    if (!this.shelfFit() || !this.boardWidth()) return this.shelfZoom();
    const fitted = Math.floor((this.boardWidth() - SHELF_CHROME_PX) / this.store.window().weeks);
    return Math.max(SHELF_FIT_MIN_PX, Math.min(ZOOM_MAX, fitted));
  });

  /** Zoom et « tout voir » du mode affiché : c'est ce que pilote la barre d'outils. */
  readonly activeCellW = computed(() => (this.mode() === 'etagere' ? this.shelfCellW() : this.cellW()));
  readonly activeFit = computed(() => (this.mode() === 'etagere' ? this.shelfFit() : this.fit()));

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

  /**
   * Fenêtre « Nouveau caillou » : `null` = fermée ; `teamId` = l'équipe visée,
   * ou `null` pour créer le projet dans le bac commun.
   */
  readonly newProjectFor = signal<{ teamId: string | null } | null>(null);

  constructor() {
    effect(() => {
      const view: StoredView = {
        zoom: this.zoom(),
        fit: this.fit(),
        period: this.periodChoice(),
        custom: this.custom(),
        mode: this.mode(),
        shelfZoom: this.shelfZoom(),
        shelfFit: this.shelfFit(),
        dockOpen: this.dockOpen(),
      };
      try {
        localStorage.setItem(VIEW_KEY, JSON.stringify(view));
      } catch {
        // Stockage indisponible (navigation privée…) : l'affichage ne sera simplement pas retenu.
      }
    });
  }

  /** Toucher au zoom du mode affiché quitte son « tout voir ». */
  setZoom(px: number): void {
    const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(px)));
    if (this.mode() === 'etagere') {
      this.shelfZoom.set(zoom);
      this.shelfFit.set(false);
    } else {
      this.zoom.set(zoom);
      this.fit.set(false);
    }
  }

  toggleFit(): void {
    if (this.mode() === 'etagere') this.shelfFit.update((v) => !v);
    else this.fit.update((v) => !v);
  }

  /** L'Étagère est en lecture seule : y entrer désélectionne la brique (ce qui ferme l'inspecteur). */
  setMode(mode: ViewMode): void {
    if (mode === 'etagere') {
      this.store.select(null);
      this.newProjectFor.set(null);
    }
    this.mode.set(mode);
  }

  setCustomPeriod(period: Period): void {
    this.custom.set(period);
    this.periodChoice.set('custom');
  }
}

function readView(): StoredView {
  const fallback: StoredView = {
    zoom: 64,
    fit: false,
    period: '3m',
    custom: null,
    mode: 'vases',
    shelfZoom: 24,
    shelfFit: true,
    dockOpen: true,
  };
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    if (!raw) return fallback;
    const view = { ...fallback, ...(JSON.parse(raw) as Partial<StoredView>) };
    if (!(view.zoom >= ZOOM_MIN && view.zoom <= ZOOM_MAX)) view.zoom = fallback.zoom;
    if (!(view.shelfZoom >= ZOOM_MIN && view.shelfZoom <= ZOOM_MAX)) view.shelfZoom = fallback.shelfZoom;
    if (view.mode !== 'vases' && view.mode !== 'etagere') view.mode = fallback.mode;
    return view;
  } catch {
    return fallback;
  }
}
