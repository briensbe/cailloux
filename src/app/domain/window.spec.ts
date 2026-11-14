import { effectiveWindowStart, extensionToFit, isOverflowing, outsideSide, toWindowRect } from './window';

describe('window', () => {
  const today = new Date(2026, 10, 11); // mercredi 11 novembre 2026

  it('glisse avec la semaine en cours, sauf si elle a été décalée à la main', () => {
    expect(effectiveWindowStart({ start: null, weeks: 52 }, today)).toBe('2026-11-09');
    expect(effectiveWindowStart({ start: '2026-10-05', weeks: 52 }, today)).toBe('2026-10-05');
  });

  it('place une brique dans le repère de la fenêtre', () => {
    const p = { start: '2026-11-23', row: 1, weeks: 3, persons: 2 };
    expect(toWindowRect(p, '2026-11-09')).toEqual({ col: 2, row: 1, weeks: 3, persons: 2 });
    expect(toWindowRect({ ...p, start: null, row: null }, '2026-11-09')).toBeNull();
  });

  it('accepte une brique commencée avant la fenêtre (colonne négative)', () => {
    const p = { start: '2026-10-26', row: 0, weeks: 4, persons: 1 };
    const r = toWindowRect(p, '2026-11-09')!;
    expect(r.col).toBe(-2);
    expect(outsideSide(r, 52)).toBeNull();
  });

  it('repère les briques entièrement hors de la fenêtre', () => {
    expect(outsideSide({ col: -5, row: 0, weeks: 5, persons: 1 }, 52)).toBe('before');
    expect(outsideSide({ col: 52, row: 0, weeks: 2, persons: 1 }, 52)).toBe('after');
    expect(outsideSide({ col: 50, row: 0, weeks: 4, persons: 1 }, 52)).toBeNull();
  });

  it('repère les briques qui dépassent l’effectif', () => {
    expect(isOverflowing({ col: 0, row: 3, weeks: 2, persons: 2 }, 4)).toBe(true);
    expect(isOverflowing({ col: 0, row: 2, weeks: 2, persons: 2 }, 4)).toBe(false);
  });

  describe('agrandir la fenêtre pour faire tenir un projet', () => {
    const bounds = { weeks: 6, persons: 2 };

    it('ne demande rien si le projet tient déjà', () => {
      expect(extensionToFit({ weeks: 2, persons: 1 }, [], bounds, 0)).toBe(0);
    });

    it('ajoute juste les semaines nécessaires', () => {
      const rects = [{ col: 0, row: 0, weeks: 5, persons: 2 }];
      expect(extensionToFit({ weeks: 3, persons: 2 }, rects, bounds, 0)).toBe(2);
    });

    it('tient compte des briques déjà au-delà du bord droit', () => {
      const rects = [
        { col: 0, row: 0, weeks: 6, persons: 2 },
        { col: 6, row: 0, weeks: 2, persons: 2 },
      ];
      expect(extensionToFit({ weeks: 1, persons: 1 }, rects, bounds, 0)).toBe(3);
    });

    it('refuse un projet plus haut que l’effectif', () => {
      expect(extensionToFit({ weeks: 1, persons: 3 }, [], bounds, 0)).toBeNull();
    });
  });
});
