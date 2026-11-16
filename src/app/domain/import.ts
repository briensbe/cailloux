import { Project, StoneColor, STONE_COLORS } from './model';
import { cleanName, headerKey, nameKey } from './names';
import { nearestStone } from './stones';

/**
 * Import d'une liste de projets (un tableau lu dans un fichier) vers le bac commun.
 *
 * Tout est calculé ici, en fonctions pures : le dialogue d'aperçu ne garde que les choix
 * de l'utilisateur (`ImportChoices`) et appelle `reviewImport` à chaque changement.
 * Renommer une ligne, écarter un statut ou changer la charge par défaut relance donc
 * toutes les règles (doublons compris), sans logique particulière dans l'interface.
 */

/** L'export Excel n'a pas de charge : 5 j/h, soit une case (1 personne × 1 semaine). */
export const DEFAULT_IMPORT_CHARGE = 5;

/**
 * - `new` : importable ;
 * - `existing` : un projet de ce nom est déjà dans le planning ;
 * - `duplicate` : une ligne précédente du fichier porte déjà ce nom ;
 * - `ignored` : pas de nom.
 */
export type LineState = 'new' | 'existing' | 'duplicate' | 'ignored';

/** Ce que l'utilisateur a changé sur une ligne de l'aperçu. */
export interface LineOverride {
  name?: string;
  charge?: number;
  checked?: boolean;
}

export interface ImportChoices {
  defaultCharge: number;
  /** Valeurs de la colonne « Statut » écartées. */
  excludedStatuses: ReadonlySet<string>;
  /** Par numéro de ligne de données (0 = la ligne qui suit les en-têtes). */
  overrides: ReadonlyMap<number, LineOverride>;
}

export interface ImportLine {
  /** Numéro de la ligne de données (0 = la ligne qui suit les en-têtes). */
  index: number;
  /** Le nom tel qu'il est écrit dans le fichier. */
  sourceName: string;
  /** Le nom qui sera donné au projet (nettoyé, ou renommé dans l'aperçu). */
  name: string;
  state: LineState;
  checked: boolean;
  charge: number;
  color: StoneColor;
  /** Valeur de la colonne « Statut », ou `null` si le fichier n'en a pas. */
  status: string | null;
  meta: Record<string, string>;
}

export interface StatusCount {
  value: string;
  count: number;
}

export interface ImportReview {
  lines: ImportLine[];
  /** Les valeurs de « Statut » présentes dans le fichier, dans leur ordre d'apparition. */
  statuses: StatusCount[];
  /** Nombre et charge des lignes cochées. */
  count: number;
  charge: number;
}

/** Ce que le store reçoit pour créer un projet importé. */
export interface ImportDraft {
  name: string;
  charge: number;
  color: StoneColor;
  meta: Record<string, string>;
}

/** Colonne des noms : « Nom Projet », sinon « Nom » (sans tenir compte des accents ni de la casse). */
export function findNameColumn(headers: readonly string[]): number | null {
  const keys = headers.map(headerKey);
  for (const wanted of ['nom projet', 'nom']) {
    const i = keys.indexOf(wanted);
    if (i >= 0) return i;
  }
  return null;
}

/**
 * L'aperçu d'un import : chaque ligne du tableau avec son nom final, son état, sa coche,
 * sa charge, sa pierre et ses métadonnées.
 *
 * @param table première ligne = en-têtes, puis une ligne par projet
 * @param existing tous les projets du planning, quelles que soient leur équipe et leur place
 * @param firstColorIndex rang de la prochaine pierre du bac commun (son nombre de projets)
 */
export function reviewImport(
  table: readonly (readonly string[])[],
  existing: readonly Project[],
  choices: ImportChoices,
  firstColorIndex: number,
): ImportReview {
  const headers = table[0] ?? [];
  const nameCol = findNameColumn(headers);
  if (nameCol === null) return { lines: [], statuses: [], count: 0, charge: 0 };

  const statusCol = headers.findIndex((h) => headerKey(h) === 'statut');
  const colorCol = headers.findIndex((h) => headerKey(h) === 'couleur');
  const metaCols = metaColumns(headers, nameCol);
  const defaultCharge = validCharge(choices.defaultCharge)
    ? choices.defaultCharge
    : DEFAULT_IMPORT_CHARGE;

  const known = new Set(existing.map((p) => nameKey(p.name)));
  const taken = new Set<string>();
  const statuses = new Map<string, number>();
  let rotation = 0;

  const lines = table.slice(1).map((row, index): ImportLine => {
    const override = choices.overrides.get(index) ?? {};
    const sourceName = row[nameCol] ?? '';
    const name = cleanName(override.name ?? sourceName);
    const key = nameKey(name);

    let state: LineState;
    if (key === '') state = 'ignored';
    else if (known.has(key)) state = 'existing';
    else if (taken.has(key)) state = 'duplicate';
    else state = 'new';
    if (state === 'new') taken.add(key);

    const status = statusCol >= 0 ? (row[statusCol] ?? '').trim() : null;
    if (status !== null) statuses.set(status, (statuses.get(status) ?? 0) + 1);
    const allowed = status === null || !choices.excludedStatuses.has(status);

    const color =
      (colorCol >= 0 ? nearestStone(row[colorCol] ?? '') : null) ??
      STONE_COLORS[(firstColorIndex + rotation++) % STONE_COLORS.length];

    return {
      index,
      sourceName,
      name,
      state,
      // Une ligne non importable n'est jamais cochée, quoi qu'en dise la coche manuelle.
      checked: state === 'new' && (override.checked ?? allowed),
      charge: validCharge(override.charge) ? override.charge : defaultCharge,
      color,
      status,
      meta: metaOf(row, metaCols),
    };
  });

  const checked = lines.filter((l) => l.checked);
  return {
    lines,
    statuses: [...statuses].map(([value, count]) => ({ value, count })),
    count: checked.length,
    charge: checked.reduce((sum, l) => sum + l.charge, 0),
  };
}

/**
 * Écarte un statut, ou le retient de nouveau. Les coches posées à la main sur les lignes de ce
 * statut sont oubliées : retenir un statut recoche ainsi toutes ses lignes importables.
 */
export function toggleStatus(
  choices: ImportChoices,
  review: ImportReview,
  status: string,
): ImportChoices {
  const excluded = new Set(choices.excludedStatuses);
  if (!excluded.delete(status)) excluded.add(status);

  const overrides = new Map(choices.overrides);
  for (const line of review.lines) {
    const override = overrides.get(line.index);
    if (line.status !== status || override?.checked === undefined) continue;
    const rest = { ...override };
    delete rest.checked;
    overrides.set(line.index, rest);
  }
  return { ...choices, excludedStatuses: excluded, overrides };
}

/** Les projets à créer : les lignes cochées. */
export function importDrafts(review: ImportReview): ImportDraft[] {
  return review.lines
    .filter((l) => l.checked)
    .map(({ name, charge, color, meta }) => ({ name, charge, color, meta }));
}

/** Toutes les colonnes sauf celle des noms, avec un en-tête non vide ; un en-tête répété ne compte qu'une fois. */
function metaColumns(
  headers: readonly string[],
  nameCol: number,
): { col: number; header: string }[] {
  const seen = new Set<string>();
  const cols: { col: number; header: string }[] = [];
  headers.forEach((raw, col) => {
    const header = raw.trim();
    if (col === nameCol || header === '' || seen.has(header)) return;
    seen.add(header);
    cols.push({ col, header });
  });
  return cols;
}

function metaOf(
  row: readonly string[],
  cols: { col: number; header: string }[],
): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const { col, header } of cols) {
    const value = (row[col] ?? '').trim();
    if (value !== '') meta[header] = value;
  }
  return meta;
}

function validCharge(charge: number | undefined): charge is number {
  return charge !== undefined && Number.isFinite(charge) && charge > 0;
}
