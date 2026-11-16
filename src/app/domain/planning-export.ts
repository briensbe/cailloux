import { cleanName, nameKey } from './names';
import { mondayIso } from './weeks';

/**
 * Lecture d'un export JSON de l'outil de planification (vue « resource »).
 *
 * Le fichier vient d'un autre outil : on vérifie chaque champ utile au lieu de faire confiance
 * à un type. Seule la liste `projets` sert ; `synthese` et `arborescenceVue` en sont des cumuls.
 */

export interface ExportedProject {
  /** Nom nettoyé (`cleanName`). */
  name: string;
  /** Équipe du projet (la première, un seul rôle étant pris en compte), ou `null`. */
  team: string | null;
  /** Jours planifiés par semaine : lundi ISO → jours, valeurs strictement positives. */
  load: Record<string, number>;
  /** Le « restant » des chiffres du projet, s'il est donné. */
  remaining: number | null;
  /** Couleur d'origine (hexadécimal), si elle est donnée. */
  color: string | null;
  /** Informations d'origine, en texte lisible (voir `exportMeta`). */
  meta: Record<string, string>;
}

export interface PlanningExport {
  /** Noms des équipes, dans l'ordre du fichier. */
  teams: string[];
  projects: ExportedProject[];
}

/** L'export lu, ou `null` si ce n'est pas un export de planification (pas de listes `projets` et `equipes`). */
export function parsePlanningExport(data: unknown): PlanningExport | null {
  if (!isObject(data) || !Array.isArray(data['projets']) || !Array.isArray(data['equipes']))
    return null;

  const teams: string[] = [];
  const addTeam = (name: string | null) => {
    if (name && !teams.some((t) => nameKey(t) === nameKey(name))) teams.push(name);
  };
  for (const t of data['equipes']) addTeam(isObject(t) ? text(t['nom']) : null);

  const seen = new Set<string>();
  const projects: ExportedProject[] = [];
  for (const raw of data['projets']) {
    if (!isObject(raw)) continue;
    const name = cleanName(text(raw['nom']) ?? '');
    const key = nameKey(name);
    // Sans nom, pas d'identité ; un nom répété : seul le premier compte (comme pour l'import Excel).
    if (key === '' || seen.has(key)) continue;
    seen.add(key);

    const teamsOfProject = Array.isArray(raw['equipes']) ? raw['equipes'].filter(isObject) : [];
    const team = teamsOfProject.map((t) => text(t['nom'])).find((n) => n !== null) ?? null;
    addTeam(team);

    const chiffres = isObject(raw['chiffres']) ? raw['chiffres'] : {};
    projects.push({
      name,
      team,
      load: weeklyLoad(raw['chargesParSemaine']),
      remaining: number(chiffres['restant']),
      color: text(raw['couleur']),
      meta: exportMeta(raw, chiffres, teamsOfProject),
    });
  }
  return { teams, projects };
}

/** « 07/12 : 1 · 14/12 : 0,5 (2 semaines, 1,5 j) » : la répartition d'une charge, en texte. */
export function describeLoad(load: Record<string, number>): string {
  const weeks = Object.keys(load).sort();
  const total = weeks.reduce((sum, w) => sum + load[w], 0);
  const parts = weeks.map((w) => `${shortDate(w)} : ${fr(load[w])}`);
  return `${parts.join(' · ')} (${weeks.length} ${weeks.length > 1 ? 'semaines' : 'semaine'}, ${fr(round(total))} j)`;
}

/** « 2026-12-07 » → « 07/12 ». */
export function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function weeklyLoad(raw: unknown): Record<string, number> {
  const load: Record<string, number> = {};
  if (!isObject(raw)) return load;
  for (const [week, value] of Object.entries(raw)) {
    const days = number(value);
    if (days === null || days <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(week)) continue;
    // Par sécurité, une date qui ne serait pas un lundi est ramenée au lundi de sa semaine.
    const monday = mondayIso(week);
    load[monday] = round((load[monday] ?? 0) + days);
  }
  return load;
}

/** Les libellés reprennent ceux de l'export Excel quand ils existent, pour que les deux imports se complètent. */
function exportMeta(
  raw: Record<string, unknown>,
  chiffres: Record<string, unknown>,
  teams: Record<string, unknown>[],
): Record<string, string> {
  const meta: Record<string, string> = {};
  const put = (key: string, value: string | null) => {
    const v = value?.trim();
    if (v) meta[key] = v;
  };
  put('Code Projet', text(raw['code']));
  put('Référence Externe', text(raw['referenceExterne']));
  put('Statut', text(raw['statut']));
  put('Chef de Projet', text(raw['chefProjet']));
  put('Couleur', text(raw['couleur']));

  const labels: [string, string][] = [
    ['initial', 'initial'],
    ['revise', 'révisé'],
    ['previsionnel', 'prévisionnel'],
    ['consomme', 'consommé'],
    ['restant', 'restant'],
  ];
  put(
    'Chiffres',
    labels
      .map(([k, label]) => [label, number(chiffres[k])] as const)
      .filter(([, v]) => v !== null)
      .map(([label, v]) => `${label} ${fr(v!)}`)
      .join(' · '),
  );

  const comments: string[] = [];
  for (const team of teams) {
    for (const res of Array.isArray(team['ressources'])
      ? team['ressources'].filter(isObject)
      : []) {
      for (const p of Array.isArray(res['planifications'])
        ? res['planifications'].filter(isObject)
        : []) {
        const comment = text(p['commentaire'])?.trim();
        const week = text(p['semaine']);
        if (comment && week) comments.push(`${shortDate(week)} : ${comment}`);
      }
    }
  }
  put('Commentaires', comments.join(' · '));
  return meta;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

function number(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Les sommes de jours décimaux (0,1 + 0,2…) traînent des erreurs de flottants : on arrondit au centième. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function fr(n: number): string {
  return String(n).replace('.', ',');
}
