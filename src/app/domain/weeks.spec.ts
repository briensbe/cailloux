import { addWeeks, currentMonday, mondayIso, weeksBetween } from './weeks';

describe('weeks', () => {
  it('compte les semaines entre deux lundis, dans les deux sens', () => {
    expect(weeksBetween('2026-11-09', '2026-11-30')).toBe(3);
    expect(weeksBetween('2026-11-30', '2026-11-09')).toBe(-3);
    expect(weeksBetween('2026-11-09', '2026-11-09')).toBe(0);
  });

  it("ne se laisse pas piéger par le passage à l'heure d'hiver (25 octobre 2026)", () => {
    expect(weeksBetween('2026-10-19', '2026-11-02')).toBe(2);
    expect(addWeeks('2026-10-19', 1)).toBe('2026-10-26');
  });

  it("ne se laisse pas piéger par le passage à l'heure d'été (28 mars 2027)", () => {
    expect(addWeeks('2027-03-22', 1)).toBe('2027-03-29');
    expect(weeksBetween('2027-03-22', '2027-04-05')).toBe(2);
  });

  it('ajoute et retire des semaines en changeant de mois et d’année', () => {
    expect(addWeeks('2026-12-28', 1)).toBe('2027-01-04');
    expect(addWeeks('2026-11-09', -2)).toBe('2026-10-26');
  });

  it('ramène une date au lundi de sa semaine', () => {
    expect(mondayIso('2026-11-14')).toBe('2026-11-09');
    expect(mondayIso('2026-11-15')).toBe('2026-11-09');
    expect(currentMonday(new Date(2026, 10, 11))).toBe('2026-11-09');
  });
});
