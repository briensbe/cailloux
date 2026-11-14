import { canOccupy, compact, findFirstFit, findNearestFree, largestFreeRect, Occupancy, overlaps } from './geometry';

describe('geometry', () => {
  const bounds = { weeks: 6, persons: 3 };

  it('détecte les chevauchements, pas les briques qui se touchent', () => {
    const a = { col: 0, row: 0, weeks: 2, persons: 2 };
    expect(overlaps(a, { col: 1, row: 1, weeks: 2, persons: 2 })).toBe(true);
    expect(overlaps(a, { col: 2, row: 0, weeks: 2, persons: 2 })).toBe(false);
    expect(overlaps(a, { col: 0, row: 2, weeks: 1, persons: 1 })).toBe(false);
  });

  it('compte les cases libres et les personnes disponibles par semaine', () => {
    const occ = new Occupancy(bounds, [{ col: 0, row: 0, weeks: 2, persons: 3 }, { col: 3, row: 1, weeks: 1, persons: 1 }]);
    expect(occ.freeCells()).toBe(18 - 7);
    expect(occ.freePerWeek()).toEqual([0, 0, 3, 2, 3, 3]);
  });

  it('refuse un rectangle qui sort du vase', () => {
    const occ = new Occupancy(bounds, []);
    expect(occ.isFree({ col: 5, row: 0, weeks: 2, persons: 1 })).toBe(false);
    expect(occ.isFree({ col: 0, row: 2, weeks: 1, persons: 2 })).toBe(false);
    expect(occ.isFree({ col: 0, row: 0, weeks: 6, persons: 3 })).toBe(true);
  });

  it('trouve la première place libre, au plus tôt puis au fond', () => {
    const occ = new Occupancy(bounds, [{ col: 0, row: 0, weeks: 2, persons: 2 }]);
    expect(findFirstFit({ weeks: 1, persons: 1 }, occ)).toEqual({ col: 0, row: 2 });
    expect(findFirstFit({ weeks: 2, persons: 2 }, occ)).toEqual({ col: 2, row: 0 });
    expect(findFirstFit({ weeks: 7, persons: 1 }, occ)).toBeNull();
  });

  it("aimante vers la case libre suivante sur la même ligne", () => {
    const occ = new Occupancy(bounds, [{ col: 2, row: 0, weeks: 2, persons: 1 }]);
    // Viser la colonne 3 (occupée) : la brique glisse sur la même ligne plutôt que de monter.
    expect(findNearestFree({ col: 3, row: 0 }, { weeks: 1, persons: 1 }, occ)).toEqual({ col: 4, row: 0 });
    // Viser hors du vase : la brique est ramenée au bord.
    expect(findNearestFree({ col: 9, row: 0 }, { weeks: 2, persons: 1 }, occ)).toEqual({ col: 4, row: 0 });
  });

  it("ignore la position propre d'un projet passé comme taille", () => {
    // Un projet porte ses col/row : ils ne doivent pas remplacer la position candidate.
    const occ = new Occupancy(bounds, [{ col: 0, row: 0, weeks: 3, persons: 3 }]);
    const project = { col: 5, row: 0, weeks: 2, persons: 1 };
    expect(findNearestFree({ col: 1, row: 1 }, project, occ)).toEqual({ col: 3, row: 1 });
    expect(findFirstFit(project, occ)).toEqual({ col: 3, row: 0 });
  });

  it('mesure le plus gros caillou qui passe encore', () => {
    const occ = new Occupancy(bounds, [{ col: 0, row: 0, weeks: 4, persons: 3 }]);
    expect(largestFreeRect(occ)).toEqual({ weeks: 2, persons: 3 });
    const full = new Occupancy(bounds, [{ col: 0, row: 0, weeks: 6, persons: 3 }]);
    expect(largestFreeRect(full)).toBeNull();
  });

  it('tasse les briques vers le début et le fond sans chevauchement', () => {
    const items = [
      { id: 'a', col: 2, row: 1, weeks: 2, persons: 1 },
      { id: 'b', col: 4, row: 0, weeks: 1, persons: 2 },
    ];
    const moved = compact(items);
    expect(moved.get('a')).toEqual({ col: 0, row: 0 });
    // b glisse jusqu'à buter contre a, qui occupe désormais le fond des semaines 0 et 1.
    expect(moved.get('b')).toEqual({ col: 2, row: 0 });
  });

  it('cherche la première place à partir d’une semaine donnée', () => {
    const occ = new Occupancy(bounds, []);
    expect(findFirstFit({ weeks: 2, persons: 1 }, occ, 3)).toEqual({ col: 3, row: 0 });
    expect(findFirstFit({ weeks: 2, persons: 1 }, occ, 5)).toBeNull();
  });

  it('tasse sans passer sous la semaine en cours ni déplacer les projets commencés', () => {
    const items = [
      { id: 'commence', col: -2, row: 0, weeks: 3, persons: 1 },
      { id: 'futur', col: 4, row: 0, weeks: 2, persons: 1 },
      { id: 'haut', col: 3, row: 1, weeks: 1, persons: 1 },
    ];
    const moved = compact(items, 0);
    expect(moved.get('commence')).toEqual({ col: -2, row: 0 });
    // La colonne 0 du fond est encore prise par le projet commencé.
    expect(moved.get('futur')).toEqual({ col: 1, row: 0 });
    expect(moved.get('haut')).toEqual({ col: 0, row: 1 });
  });

  it('autorise une brique commencée avant la fenêtre, dans l’effectif et avant le bord droit', () => {
    const others = [{ col: 2, row: 0, weeks: 2, persons: 1 }];
    expect(canOccupy({ col: -3, row: 0, weeks: 5, persons: 1 }, others, bounds)).toBe(true);
    expect(canOccupy({ col: -3, row: 0, weeks: 6, persons: 1 }, others, bounds)).toBe(false);
    expect(canOccupy({ col: 4, row: 2, weeks: 2, persons: 2 }, others, bounds)).toBe(false);
    expect(canOccupy({ col: 5, row: 0, weeks: 2, persons: 1 }, others, bounds)).toBe(false);
  });
});
