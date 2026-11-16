import {
  DEFAULT_IMPORT_CHARGE,
  findNameColumn,
  ImportChoices,
  importDrafts,
  LineOverride,
  reviewImport,
  toggleStatus,
} from './import';
import { Project, STONE_COLORS } from './model';

const HEADERS = [
  'Code Projet',
  'Nom Projet',
  'Statut',
  'Description',
  'Référence Externe',
  'Couleur',
];

function choices(
  overrides: [number, LineOverride][] = [],
  extra: Partial<ImportChoices> = {},
): ImportChoices {
  return {
    defaultCharge: DEFAULT_IMPORT_CHARGE,
    excludedStatuses: new Set(),
    overrides: new Map(overrides),
    ...extra,
  };
}

function project(name: string, extra: Partial<Project> = {}): Project {
  return {
    id: `p-${name}`,
    teamId: null,
    name,
    charge: 20,
    weeks: 4,
    persons: 1,
    mode: 'free',
    color: 'jade',
    start: null,
    row: null,
    ...extra,
  };
}

describe('import', () => {
  describe('findNameColumn', () => {
    it('trouve « Nom Projet », sinon « Nom », sans tenir compte des accents ni de la casse', () => {
      expect(findNameColumn(['Statut', 'nom projet', 'Code Projet'])).toBe(1);
      expect(findNameColumn(['Code', 'NOM'])).toBe(1);
      expect(findNameColumn(['Nom', 'Nom Projet'])).toBe(1);
    });

    it('renvoie null sans colonne de nom', () => {
      expect(findNameColumn(['Code', 'Statut'])).toBeNull();
    });
  });

  describe('reviewImport', () => {
    it("lit les noms dans leur colonne, quel que soit l'ordre des colonnes", () => {
      const table = [
        ['Statut', 'nom projet', 'Code Projet'],
        ['En cours', 'Offre crypto', '2026_002'],
      ];
      const review = reviewImport(table, [], choices(), 0);
      expect(review.lines[0].name).toBe('Offre crypto');
      expect(review.lines[0].state).toBe('new');
    });

    it('ignore une ligne sans nom et ne la coche pas, même à la main', () => {
      const table = [HEADERS, ['X', '   ', 'En cours', '', '', '']];
      const review = reviewImport(table, [], choices([[0, { checked: true }]]), 0);
      expect(review.lines[0].state).toBe('ignored');
      expect(review.lines[0].checked).toBe(false);
      expect(review.count).toBe(0);
    });

    it('reconnaît un projet existant malgré les espaces et la casse', () => {
      const table = [HEADERS, ['', '  bcef -  Etude change ', '', '', '', '']];
      const review = reviewImport(table, [project('BCEF - Etude change')], choices(), 0);
      expect(review.lines[0].state).toBe('existing');
      expect(review.lines[0].checked).toBe(false);
    });

    it('nettoie le nom importé', () => {
      const table = [HEADERS, ['', 'Offre crypto  ', '', '', '', '']];
      expect(importDrafts(reviewImport(table, [], choices(), 0))[0].name).toBe('Offre crypto');
    });

    it('compte comme existant un projet posé dans un vase (ré-import)', () => {
      const placed = project('Offre crypto', { teamId: 't-1', start: '2026-11-16', row: 0 });
      const table = [HEADERS, ['', 'Offre crypto', '', '', '', '']];
      expect(reviewImport(table, [placed], choices(), 0).lines[0].state).toBe('existing');
    });

    it('marque les noms répétés dans le fichier, puis accepte la ligne renommée', () => {
      const table = [
        HEADERS,
        ['2024_003', 'Trajectoire mobile vers RSW', '', '', '', ''],
        ['2024_001', 'Trajectoire mobile vers RSW', '', '', '', ''],
      ];
      const before = reviewImport(table, [], choices(), 0);
      expect(before.lines.map((l) => l.state)).toEqual(['new', 'duplicate']);
      expect(before.count).toBe(1);

      const renamed = choices([[1, { name: 'Trajectoire mobile vers RSW (2024_001)' }]]);
      const after = reviewImport(table, [], renamed, 0);
      expect(after.lines.map((l) => l.state)).toEqual(['new', 'new']);
      expect(after.lines[1].checked).toBe(true);
      expect(importDrafts(after).map((d) => d.name)).toEqual([
        'Trajectoire mobile vers RSW',
        'Trajectoire mobile vers RSW (2024_001)',
      ]);
    });

    it('respecte les coches manuelles', () => {
      const table = [
        HEADERS,
        ['', 'A', '', '', '', ''],
        ['', 'B', '', '', '', ''],
        ['', 'C', '', '', '', ''],
      ];
      const review = reviewImport(table, [], choices([[1, { checked: false }]]), 0);
      expect(importDrafts(review).map((d) => d.name)).toEqual(['A', 'C']);
    });

    it('applique la charge par défaut et la charge saisie sur une ligne', () => {
      const table = [HEADERS, ['', 'Offre crypto', '', '', '', ''], ['', 'Autre', '', '', '', '']];
      const review = reviewImport(
        table,
        [],
        choices([[0, { charge: 40 }]], { defaultCharge: 10 }),
        0,
      );
      expect(review.lines.map((l) => l.charge)).toEqual([40, 10]);
      expect(review.charge).toBe(50);
    });

    it('revient à 5 j/h pour une charge invalide', () => {
      const table = [HEADERS, ['', 'A', '', '', '', '']];
      const review = reviewImport(
        table,
        [],
        choices([[0, { charge: -3 }]], { defaultCharge: 0 }),
        0,
      );
      expect(review.lines[0].charge).toBe(DEFAULT_IMPORT_CHARGE);
    });

    it('garde en métadonnées les valeurs non vides, sous leur en-tête d’origine', () => {
      const table = [
        HEADERS,
        ['2026_002', 'Offre crypto', 'En cours', '  ', 'SUIVI-2177', '#22c55e'],
      ];
      expect(reviewImport(table, [], choices(), 0).lines[0].meta).toEqual({
        'Code Projet': '2026_002',
        Statut: 'En cours',
        'Référence Externe': 'SUIVI-2177',
        Couleur: '#22c55e',
      });
    });

    it('choisit la pierre d’après la couleur, sinon suit la rotation du bac commun', () => {
      const table = [
        HEADERS,
        ['', 'Vert', '', '', '', '#22c55e'],
        ['', 'Sans couleur 1', '', '', '', ''],
        ['', 'Sans couleur 2', '', '', '', 'pas une couleur'],
      ];
      const review = reviewImport(table, [], choices(), 3);
      expect(review.lines.map((l) => l.color)).toEqual(['jade', STONE_COLORS[3], STONE_COLORS[4]]);
    });

    it('renvoie un aperçu vide sans colonne de nom', () => {
      expect(reviewImport([['Code'], ['X']], [], choices(), 0).lines).toEqual([]);
    });
  });

  describe('filtre par statut', () => {
    const table = [
      HEADERS,
      ['', 'A', 'En cours', '', '', ''],
      ['', 'B', 'En pause', '', '', ''],
      ['', 'C', 'En pause', '', '', ''],
    ];

    it('compte les lignes de chaque statut', () => {
      expect(reviewImport(table, [], choices(), 0).statuses).toEqual([
        { value: 'En cours', count: 1 },
        { value: 'En pause', count: 2 },
      ]);
    });

    it('écarter un statut décoche ses lignes, le retenir les recoche', () => {
      let c = choices([[1, { checked: false }]]);
      const start = reviewImport(table, [], c, 0);
      expect(start.count).toBe(2);

      c = toggleStatus(c, start, 'En pause');
      const excluded = reviewImport(table, [], c, 0);
      expect(excluded.lines.map((l) => l.checked)).toEqual([true, false, false]);
      expect(excluded.count).toBe(1);

      c = toggleStatus(c, excluded, 'En pause');
      const back = reviewImport(table, [], c, 0);
      expect(back.lines.map((l) => l.checked)).toEqual([true, true, true]);
    });

    it('laisse une ligne d’un statut écarté être cochée à la main', () => {
      const c = choices([[1, { checked: true }]], { excludedStatuses: new Set(['En pause']) });
      expect(reviewImport(table, [], c, 0).lines.map((l) => l.checked)).toEqual([
        true,
        true,
        false,
      ]);
    });
  });
});
