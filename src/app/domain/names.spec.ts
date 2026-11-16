import { cleanName, headerKey, nameKey } from './names';

describe('names', () => {
  describe('cleanName', () => {
    it('retire les espaces de début et de fin, et garde le reste tel quel', () => {
      expect(cleanName('  Offre crypto  ')).toBe('Offre crypto');
      expect(cleanName('BCEF -  Etude')).toBe('BCEF -  Etude');
    });

    it('unifie les écritures Unicode (NFC)', () => {
      expect(cleanName('Création')).toBe('Création');
    });
  });

  describe('nameKey', () => {
    it('ignore les espaces en trop et la casse', () => {
      expect(nameKey('  bcef -  Etude change ')).toBe(nameKey('BCEF - Etude change'));
    });

    it("traite l'espace insécable comme une espace", () => {
      expect(nameKey('Offre crypto')).toBe(nameKey('Offre crypto'));
    });

    it('confond les deux écritures Unicode du même caractère', () => {
      expect(nameKey('Création')).toBe(nameKey('Création'));
    });

    it('garde les accents', () => {
      expect(nameKey('Etude')).not.toBe(nameKey('Étude'));
    });
  });

  describe('headerKey', () => {
    it('ignore accents, casse et espaces', () => {
      expect(headerKey('Référence Externe')).toBe('reference externe');
      expect(headerKey(' reference  EXTERNE')).toBe('reference externe');
      expect(headerKey('Nom Projet')).toBe('nom projet');
    });
  });
});
