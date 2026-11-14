/** Géométrie du vase : collisions, places libres, aimantation et tassement. */

export interface Cell {
  col: number;
  row: number;
}

export interface Size {
  weeks: number;
  persons: number;
}

export interface Rect extends Cell, Size {}

/** Dimensions du vase : `weeks` colonnes × `persons` lignes. */
export type Bounds = Size;

export function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.col < b.col + b.weeks &&
    b.col < a.col + a.weeks &&
    a.row < b.row + b.persons &&
    b.row < a.row + a.persons
  );
}

/**
 * Carte d'occupation d'un vase.
 *
 * On pré-calcule les sommes préfixées 2D de la grille (une « summed-area table ») :
 * savoir combien de cases sont prises dans n'importe quel rectangle coûte alors
 * 4 lectures, quelle que soit sa taille. C'est ce qui permet de tester des centaines
 * de positions candidates à chaque mouvement de souris sans ralentir le drag.
 */
export class Occupancy {
  private readonly sums: Int32Array;
  private readonly stride: number;

  constructor(
    readonly bounds: Bounds,
    rects: readonly Rect[],
  ) {
    const { weeks: W, persons: H } = bounds;
    const cells = new Uint8Array(W * H);
    for (const r of rects) {
      for (let row = Math.max(0, r.row); row < Math.min(H, r.row + r.persons); row++) {
        for (let col = Math.max(0, r.col); col < Math.min(W, r.col + r.weeks); col++) {
          cells[row * W + col] = 1;
        }
      }
    }
    // sums[(y) * stride + x] = nombre de cases occupées dans le rectangle [0, x[ × [0, y[
    const s = (this.stride = W + 1);
    this.sums = new Int32Array((W + 1) * (H + 1));
    for (let row = 0; row < H; row++) {
      for (let col = 0; col < W; col++) {
        this.sums[(row + 1) * s + col + 1] =
          cells[row * W + col] +
          this.sums[row * s + col + 1] +
          this.sums[(row + 1) * s + col] -
          this.sums[row * s + col];
      }
    }
  }

  contains(r: Rect): boolean {
    return (
      r.col >= 0 &&
      r.row >= 0 &&
      r.weeks >= 1 &&
      r.persons >= 1 &&
      r.col + r.weeks <= this.bounds.weeks &&
      r.row + r.persons <= this.bounds.persons
    );
  }

  isFree(r: Rect): boolean {
    return this.contains(r) && this.count(r) === 0;
  }

  freeCells(): number {
    const all = { col: 0, row: 0, ...this.bounds };
    return this.bounds.weeks * this.bounds.persons - this.count(all);
  }

  /** Nombre de personnes encore disponibles, semaine par semaine. */
  freePerWeek(): number[] {
    const H = this.bounds.persons;
    return Array.from({ length: this.bounds.weeks }, (_, col) => {
      return H - this.count({ col, row: 0, weeks: 1, persons: H });
    });
  }

  /** Cases occupées dans un rectangle supposé contenu dans le vase. */
  private count(r: Rect): number {
    const s = this.stride;
    const [x0, y0, x1, y1] = [r.col, r.row, r.col + r.weeks, r.row + r.persons];
    return this.sums[y1 * s + x1] - this.sums[y0 * s + x1] - this.sums[y1 * s + x0] + this.sums[y0 * s + x0];
  }
}

/**
 * Rectangle candidat. On recopie explicitement `weeks` et `persons` : un `{ col, row, ...size }`
 * serait piégeux, car si `size` est un projet entier, ses propres `col`/`row` écraseraient le candidat.
 */
function at(col: number, row: number, size: Size): Rect {
  return { col, row, weeks: size.weeks, persons: size.persons };
}

/**
 * La brique peut-elle occuper ce rectangle ? Variante de `Occupancy.isFree` pour les gestes
 * sur une brique déjà posée : elle peut commencer avant le bord gauche (projet commencé),
 * mais doit rester sous l'effectif, avant le bord droit et sans chevaucher ses voisines.
 */
export function canOccupy(r: Rect, others: readonly Rect[], bounds: Bounds): boolean {
  return (
    r.row >= 0 &&
    r.weeks >= 1 &&
    r.persons >= 1 &&
    r.row + r.persons <= bounds.persons &&
    r.col + r.weeks <= bounds.weeks &&
    others.every((o) => !overlaps(r, o))
  );
}

/** Première place libre à partir de `fromCol` : la semaine la plus tôt, puis le plus près du fond. */
export function findFirstFit(size: Size, occ: Occupancy, fromCol = 0): Cell | null {
  for (let col = Math.max(0, fromCol); col + size.weeks <= occ.bounds.weeks; col++) {
    for (let row = 0; row + size.persons <= occ.bounds.persons; row++) {
      if (occ.isFree(at(col, row, size))) return { col, row };
    }
  }
  return null;
}

/** Changer de ligne « coûte » plus cher que glisser dans le temps : la brique colle à sa ligne. */
const ROW_WEIGHT = 1.5;

/**
 * L'effet aimant : la position libre la plus proche de celle visée.
 * À distance égale, on préfère la case suivante (vers la droite) à la précédente.
 */
export function findNearestFree(desired: Cell, size: Size, occ: Occupancy): Cell | null {
  let best: Cell | null = null;
  let bestScore = Infinity;
  for (let col = 0; col + size.weeks <= occ.bounds.weeks; col++) {
    for (let row = 0; row + size.persons <= occ.bounds.persons; row++) {
      const dc = col - desired.col;
      const score = Math.abs(dc) + ROW_WEIGHT * Math.abs(row - desired.row) + (dc < 0 ? 0.1 : 0);
      if (score < bestScore && occ.isFree(at(col, row, size))) {
        best = { col, row };
        bestScore = score;
      }
    }
  }
  return best;
}

/** Le plus gros caillou qui passe encore : le rectangle libre de plus grande surface. */
export function largestFreeRect(occ: Occupancy): Size | null {
  let best: Size | null = null;
  for (let persons = 1; persons <= occ.bounds.persons; persons++) {
    for (let weeks = 1; weeks <= occ.bounds.weeks; weeks++) {
      const area = weeks * persons;
      if (best && area <= best.weeks * best.persons) continue;
      if (findFirstFit({ weeks, persons }, occ)) best = { weeks, persons };
    }
  }
  return best;
}

/**
 * « Secouer le vase » : chaque brique glisse le plus tôt possible dans le temps, sans passer
 * sous la colonne `floor` (la semaine en cours), puis tombe vers le fond, jusqu'à ce que plus
 * rien ne bouge. Les briques qui commencent avant `floor` sont des obstacles fixes : on ne
 * réécrit pas le passé. Toutes les positions intermédiaires restent valides.
 */
export function compact<T extends Rect & { id: string }>(items: readonly T[], floor = 0): Map<string, Cell> {
  const rects = items.map((i) => ({ id: i.id, col: i.col, row: i.row, weeks: i.weeks, persons: i.persons }));
  const movable = rects.filter((r) => r.col >= floor);
  const fits = (r: Rect, self: Rect) =>
    r.col >= floor && r.row >= 0 && rects.every((o) => o === self || !overlaps(r, o));

  let moved = true;
  for (let pass = 0; moved && pass < 100; pass++) {
    moved = false;
    movable.sort((a, b) => a.col - b.col || a.row - b.row);
    for (const r of movable) {
      while (fits({ ...r, col: r.col - 1 }, r)) {
        r.col--;
        moved = true;
      }
      while (fits({ ...r, row: r.row - 1 }, r)) {
        r.row--;
        moved = true;
      }
    }
  }
  return new Map(rects.map((r) => [r.id, { col: r.col, row: r.row }]));
}
