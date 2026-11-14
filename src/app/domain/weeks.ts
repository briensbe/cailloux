/** Utilitaires de calendrier : on raisonne en semaines qui commencent le lundi (norme ISO 8601). */

export interface WeekLabel {
  index: number;
  /** Numéro de semaine ISO (S1 à S53). */
  number: number;
  monday: Date;
  /** Libellé court du lundi, ex. « 9 nov. ». */
  label: string;
  /** Libellé du mois quand la semaine en contient le 1er (ou pour la première colonne). */
  month: string | null;
}

const SHORT_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const SHORT_MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function mondayOf(date: Date): Date {
  // getDay() : dimanche = 0 … samedi = 6 ; on le décale pour que lundi = 0.
  return addDays(date, -((date.getDay() + 6) % 7));
}

/** Lundi (ISO) de la semaine qui contient `date`. */
export function mondayIso(date: Date | string): string {
  return toIsoDate(mondayOf(typeof date === 'string' ? parseIsoDate(date) : date));
}

/** Lundi de la semaine en cours. */
export function currentMonday(today = new Date()): string {
  return mondayIso(today);
}

const DAY_MS = 86_400_000;

// Les écarts se calculent sur des dates UTC : en heure locale, la journée du changement d'heure
// dure 23 ou 25 heures, et un arrondi pourrait décaler une brique d'une semaine.
function utcDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** Nombre de semaines entières de `fromIso` à `toIso` (négatif si `toIso` est avant). */
export function weeksBetween(fromIso: string, toIso: string): number {
  return Math.floor((utcDay(toIso) - utcDay(fromIso)) / 7);
}

export function addWeeks(iso: string, weeks: number): string {
  const t = new Date((utcDay(iso) + weeks * 7) * DAY_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Numéro de semaine ISO : la semaine 1 est celle qui contient le premier jeudi de l'année. */
export function isoWeek(date: Date): number {
  const t = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

export function formatShort(date: Date): string {
  return SHORT_DATE.format(date);
}

export function weekLabels(startIso: string, count: number): WeekLabel[] {
  const start = parseIsoDate(startIso);
  return Array.from({ length: count }, (_, index) => {
    const monday = addDays(start, index * 7);
    const sunday = addDays(monday, 6);
    const hasFirstOfMonth = sunday.getMonth() !== monday.getMonth() || monday.getDate() === 1;
    const monthDate = monday.getDate() === 1 ? monday : sunday;
    return {
      index,
      number: isoWeek(monday),
      monday,
      label: formatShort(monday),
      month: index === 0 ? SHORT_MONTH.format(monday) : hasFirstOfMonth ? SHORT_MONTH.format(monthDate) : null,
    };
  });
}
