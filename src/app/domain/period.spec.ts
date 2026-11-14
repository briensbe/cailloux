import { largestFreeRect } from './geometry';
import { Project } from './model';
import { commonWaiting, customPeriod, periodFigures, periodOccupancy, periodOverlap, presetPeriod, sumFigures } from './period';

const brick = (p: Partial<Project>): Project => ({
  id: 'x',
  teamId: 't',
  name: 'x',
  charge: 10,
  weeks: 1,
  persons: 1,
  mode: 'free',
  color: 'jade',
  start: '2026-11-16',
  row: 0,
  ...p,
});

describe('period', () => {
  it('« Six mois » couvre 26 semaines depuis la semaine en cours', () => {
    expect(presetPeriod('6m', new Date(2026, 10, 18))).toEqual({ start: '2026-11-16', weeks: 26 });
    expect(presetPeriod('3s', new Date(2026, 10, 18)).weeks).toBe(3);
  });

  it('« Saisie de deux dates » est ramenée aux semaines entières, dans les deux sens', () => {
    expect(customPeriod('2026-12-02', '2026-12-15')).toEqual({ start: '2026-11-30', weeks: 3 });
    expect(customPeriod('2026-12-15', '2026-12-02')).toEqual({ start: '2026-11-30', weeks: 3 });
    expect(customPeriod('2026-12-02', '2026-12-02')).toEqual({ start: '2026-11-30', weeks: 1 });
  });

  it('compte les semaines d’une brique incluses dans la période', () => {
    const period = { start: '2026-11-16', weeks: 4 };
    expect(periodOverlap({ start: '2026-11-02', weeks: 4 }, period)).toBe(2);
    expect(periodOverlap({ start: '2026-11-23', weeks: 10 }, period)).toBe(3);
    expect(periodOverlap({ start: '2027-01-04', weeks: 2 }, period)).toBe(0);
    expect(periodOverlap({ start: null, weeks: 2 }, period)).toBe(0);
  });

  describe('indicateurs', () => {
    const period = { start: '2026-11-16', weeks: 13 };

    it('capacité = effectif × 5 × semaines', () => {
      expect(periodFigures(5, [], period).capacity).toBe(325);
    });

    it('« Brique à cheval » : seules les semaines incluses comptent', () => {
      // 2 personnes sur 6 semaines, dont les 2 dernières tombent dans la période.
      const f = periodFigures(5, [brick({ persons: 2, weeks: 6, charge: 60, start: '2026-10-19' })], period);
      expect(f.planned).toBe(20);
    });

    it('« L’air compte comme réservé »', () => {
      const f = periodFigures(5, [brick({ persons: 1, weeks: 3, charge: 13 })], period);
      expect(f.planned).toBe(15);
      expect(f.air).toBeCloseTo(2);
      expect(f.remaining).toBe(310);
    });

    it('« Ne tiendrait pas » : charge en attente supérieure à la capacité restante', () => {
      const projects = [
        brick({ persons: 2, weeks: 13, charge: 130 }),
        brick({ start: null, row: null, charge: 60 }),
      ];
      const f = periodFigures(1, projects, { start: '2026-11-16', weeks: 13 });
      expect(f.waiting).toBe(60);
      expect(f.remaining).toBe(-65);
      expect(f.waitingFits).toBe(false);
    });

    it('une brique en débordement crée une surcharge', () => {
      // Équipe réduite à 2 personnes, brique de 3 personnes toujours en place.
      const f = periodFigures(2, [brick({ persons: 3, weeks: 2, charge: 30 })], { start: '2026-11-16', weeks: 2 });
      expect(f.capacity).toBe(20);
      expect(f.planned).toBe(30);
      expect(f.remaining).toBe(-10);
      expect(f.fill).toBeCloseTo(1.5);
    });

    it('additionne les équipes', () => {
      const a = periodFigures(5, [], period);
      const b = periodFigures(3, [brick({ persons: 3, weeks: 1, charge: 15 })], period);
      const total = sumFigures([a, b]);
      expect(total.capacity).toBe(325 + 195);
      expect(total.remaining).toBe(325 + 180);
    });
  });

  it('limite la carte d’occupation à la période', () => {
    const projects = [
      brick({ persons: 2, weeks: 2, start: '2026-11-16' }),
      brick({ persons: 2, weeks: 10, start: '2026-12-14' }), // commence après la période
    ];
    const occ = periodOccupancy(2, projects, { start: '2026-11-16', weeks: 4 });
    expect(occ.freeCells()).toBe(4);
    expect(largestFreeRect(occ)).toEqual({ weeks: 2, persons: 2 });
  });

  describe('bac commun', () => {
    // Sur une semaine, une équipe vide de N personnes a N × 5 j/h de reste.
    const figures = (remaining: number) => periodFigures(remaining / 5, [], { start: '2026-11-16', weeks: 1 });

    it('« Bac commun face à toutes les équipes » : 337 j/h ne tiendraient pas dans 190 j/h', () => {
      const projects = [
        brick({ teamId: null, start: null, row: null, charge: 140 }),
        brick({ teamId: null, start: null, row: null, charge: 197 }),
        brick({ teamId: 't', start: null, row: null, charge: 40 }),
      ];
      expect(commonWaiting(projects, [figures(115), figures(75)])).toEqual({ charge: 337, remaining: 190, fits: false });
    });

    it('tiendrait quand la charge commune ne dépasse pas le reste', () => {
      const projects = [brick({ teamId: null, start: null, row: null, charge: 190 })];
      expect(commonWaiting(projects, [figures(115), figures(75)]).fits).toBe(true);
    });
  });
});
