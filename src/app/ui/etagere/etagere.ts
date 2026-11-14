import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Project, STONES, Team } from '../../domain/model';
import { PeriodFigures, periodFigures, sumFigures } from '../../domain/period';
import { freePersonsPerWeek, isOverflowing, outsideSide, toWindowRect } from '../../domain/window';
import { weekLabels, weeksBetween } from '../../domain/weeks';
import { PlanningStore } from '../../state/planning.store';
import { ViewService } from '../../state/view.service';

/**
 * Hauteur d'une personne dans un vase miniature (44 px dans le mode Vases) : assez pour lire
 * le nom d'un projet d'une seule personne.
 */
export const SHELF_ROW_H = 16;
/** Largeur minimale d'une brique pour y écrire son nom (tronqué par « … » au besoin). */
const NAME_MIN_W = 28;
/** Hauteur minimale d'une ligne de l'Étagère, pour que l'en-tête de l'équipe tienne : base, plus une ligne par pastille. */
const LANE_MIN_H = 64;
const TAG_H = 19;
const LANE_PAD = 18;

interface ShelfBrick {
  id: string;
  name: string;
  title: string;
  base: string;
  ink: string;
  left: number;
  width: number;
  bottom: number;
  height: number;
  overflow: boolean;
  cutStart: boolean;
  cutEnd: boolean;
  /** Assez large pour y écrire le nom. */
  labelled: boolean;
}

interface ShelfLane {
  team: Team;
  figures: PeriodFigures;
  waitingCount: number;
  bricks: ShelfBrick[];
  before: number;
  after: number;
  overflow: number;
  /** Hauteur du vase (effectif) et de la zone de débordement au-dessus du rebord, en pixels. */
  vaseH: number;
  overH: number;
  /** Hauteur de la ligne entière, identique pour l'en-tête et pour le vase. */
  laneH: number;
}

/**
 * L'Étagère : tous les vases en miniature sous une même règle du temps, pour comparer les équipes
 * d'un coup d'œil (spec `etagere`). Lecture seule : aucun geste, aucune action du store.
 *
 * Mise en page : chaque rangée (bande des personnes libres, règle, vases) a une colonne d'en-têtes
 * et une colonne de temps. Seule la colonne de temps des vases défile horizontalement ; la bande
 * et la règle la suivent par `scrollLeft`. Un seul conteneur qui défilerait dans les deux sens
 * empêcherait la règle de rester collée en haut de l'écran (`position: sticky`).
 */
@Component({
  selector: 'app-etagere',
  imports: [DecimalPipe],
  templateUrl: './etagere.html',
  styleUrl: './etagere.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Etagere {
  protected readonly store = inject(PlanningStore);
  protected readonly view = inject(ViewService);
  protected readonly rowH = SHELF_ROW_H;

  protected readonly cw = this.view.shelfCellW;
  protected readonly weeks = computed(() => this.store.window().weeks);
  protected readonly gridW = computed(() => this.weeks() * this.cw());
  protected readonly labels = computed(() => weekLabels(this.store.windowStart(), this.weeks()));

  /** Colonnes de la période, limitées à la fenêtre. */
  protected readonly periodCols = computed(() => {
    const p = this.view.period();
    const start = weeksBetween(this.store.windowStart(), p.start);
    const from = Math.max(0, start);
    const to = Math.min(this.weeks(), start + p.weeks);
    return to > from ? { from, to } : null;
  });

  protected readonly todayX = computed(() => {
    const col = this.store.todayCol();
    return col >= 0 && col < this.weeks() ? (col + 0.5) * this.cw() : null;
  });

  protected readonly lanes = computed<ShelfLane[]>(() =>
    this.store.teams().map((team) => this.lane(team, this.store.projectsOf(team.id))),
  );

  protected readonly totals = computed(() => sumFigures(this.lanes().map((l) => l.figures)));

  /** Bande « personnes libres chaque semaine, toutes équipes ». */
  protected readonly free = computed(() => {
    const teams = this.store.teams();
    const counts = freePersonsPerWeek(teams, this.store.projects(), this.store.windowStart(), this.weeks());
    const persons = teams.reduce((n, t) => n + t.size, 0);
    return counts.map((n) => ({ n, pct: persons ? (n / persons) * 100 : 0 }));
  });

  protected inPeriod(index: number): boolean {
    const pc = this.periodCols();
    return pc !== null && index >= pc.from && index < pc.to;
  }

  /** La colonne de temps des vases entraîne la bande et la règle. */
  protected syncScroll(event: Event, ...followers: HTMLElement[]): void {
    const left = (event.target as HTMLElement).scrollLeft;
    for (const el of followers) el.scrollLeft = left;
  }

  private lane(team: Team, projects: Project[]): ShelfLane {
    const weeks = this.weeks();
    const cw = this.cw();
    const placed = projects
      .map((p) => ({ p, r: toWindowRect(p, this.store.windowStart()) }))
      .filter((x): x is { p: Project; r: NonNullable<typeof x.r> } => x.r !== null);
    const visible = placed.filter(({ r }) => outsideSide(r, weeks) === null);
    const headroom = Math.max(0, ...visible.map(({ r }) => r.row + r.persons - team.size));
    const vaseH = team.size * SHELF_ROW_H;
    const overH = headroom * SHELF_ROW_H;
    const waitingCount = projects.filter((p) => p.start === null).length;
    const overflow = placed.filter(({ r }) => isOverflowing(r, team.size)).length;
    const tags = (waitingCount ? 1 : 0) + (overflow ? 1 : 0);
    return {
      team,
      figures: periodFigures(team.size, projects, this.view.period()),
      waitingCount,
      bricks: visible.map(({ p, r }) => {
        const from = Math.max(0, r.col);
        const to = Math.min(weeks, r.col + r.weeks);
        return {
          id: p.id,
          name: p.name,
          title: `${p.name} — ${p.charge} j/h · ${p.persons} pers. × ${p.weeks} sem.`,
          base: STONES[p.color].base,
          ink: STONES[p.color].ink,
          left: from * cw,
          width: (to - from) * cw,
          bottom: r.row * SHELF_ROW_H,
          height: r.persons * SHELF_ROW_H,
          overflow: isOverflowing(r, team.size),
          cutStart: r.col < 0,
          cutEnd: r.col + r.weeks > weeks,
          labelled: (to - from) * cw >= NAME_MIN_W,
        };
      }),
      before: placed.filter(({ r }) => outsideSide(r, weeks) === 'before').length,
      after: placed.filter(({ r }) => outsideSide(r, weeks) === 'after').length,
      overflow,
      vaseH,
      overH,
      laneH: Math.max(LANE_MIN_H + Math.max(1, tags) * TAG_H, vaseH + overH + LANE_PAD),
    };
  }
}
