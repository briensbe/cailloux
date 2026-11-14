import { fitToTeam, footprint, fillRatio, freeResize, personsFor, weeksFor, withCharge, withPersons, withWeeks } from './capacity';

describe('capacity', () => {
  it('convertit une charge en durée et en personnes', () => {
    expect(weeksFor(40, 2)).toBe(4);
    expect(weeksFor(41, 2)).toBe(5);
    expect(weeksFor(1, 5)).toBe(1);
    expect(personsFor(40, 8)).toBe(1);
    expect(personsFor(40, 3)).toBe(3);
  });

  it("mesure l'air laissé dans une brique arrondie à la case", () => {
    expect(footprint({ weeks: 3, persons: 1 })).toBe(15);
    expect(fillRatio({ weeks: 3, persons: 1, charge: 13 })).toBeCloseTo(13 / 15);
  });

  describe('charge fixe', () => {
    const p = { weeks: 4, persons: 2, charge: 40, mode: 'fixed' as const };

    it("étirer dans le temps diminue le nombre de personnes", () => {
      expect(withWeeks(p, 8, 5)).toEqual({ weeks: 8, persons: 1, charge: 40 });
      expect(withWeeks(p, 5, 5)).toEqual({ weeks: 5, persons: 2, charge: 40 });
    });

    it("ajouter des personnes raccourcit la durée", () => {
      expect(withPersons(p, 4, 5)).toEqual({ weeks: 2, persons: 4, charge: 40 });
    });

    it("borne la largeur entre « toute l'équipe » et « une seule personne »", () => {
      expect(withWeeks(p, 1, 3)).toEqual({ weeks: 3, persons: 3, charge: 40 });
      expect(withWeeks(p, 30, 3)).toEqual({ weeks: 8, persons: 1, charge: 40 });
    });

    it('ne dépasse jamais la taille de l’équipe', () => {
      expect(withPersons(p, 9, 3).persons).toBe(3);
    });
  });

  describe('mode libre', () => {
    const p = { weeks: 3, persons: 2, charge: 23, mode: 'free' as const };

    it('la charge suit la surface de la brique', () => {
      expect(withWeeks(p, 5, 5)).toEqual({ weeks: 5, persons: 2, charge: 50 });
      expect(withPersons(p, 3, 5)).toEqual({ weeks: 3, persons: 3, charge: 45 });
      expect(freeResize(p, 4, 4)).toEqual({ weeks: 4, persons: 4, charge: 80 });
    });

    it('garde la charge saisie tant que la forme ne change pas', () => {
      expect(freeResize(p, 3, 2).charge).toBe(23);
    });
  });

  it('changer la charge garde les personnes et recalcule la durée', () => {
    expect(withCharge({ weeks: 4, persons: 2, charge: 40, mode: 'free' }, 60)).toEqual({
      weeks: 6,
      persons: 2,
      charge: 60,
    });
  });

  describe("entrée dans un vase (fitToTeam)", () => {
    it("ramène un projet trop haut à l'effectif en gardant sa charge", () => {
      expect(fitToTeam({ weeks: 4, persons: 6, charge: 120 }, 4)).toEqual({ weeks: 6, persons: 4, charge: 120 });
    });

    it("garde la charge d'un projet en mode libre", () => {
      expect(fitToTeam({ weeks: 3, persons: 4, charge: 60 }, 2)).toEqual({ weeks: 6, persons: 2, charge: 60 });
    });

    it("ne touche pas à un projet qui tient déjà", () => {
      expect(fitToTeam({ weeks: 3, persons: 2, charge: 23 }, 5)).toEqual({ weeks: 3, persons: 2, charge: 23 });
    });
  });
});
