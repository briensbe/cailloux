import { nearestStone } from './stones';

describe('nearestStone', () => {
  // Les 15 couleurs de l'export réel « Export_Projets_Filtrés ».
  it.each([
    ['#22c55e', 'jade'],
    ['#3b82f6', 'lapis'],
    ['#f59e0b', 'ochre'],
    ['#eab308', 'ochre'],
    ['#ef4444', 'terracotta'],
    ['#10b981', 'jade'],
    ['#84cc16', 'jade'],
    ['#14b8a6', 'jade'],
    ['#f43f5e', 'terracotta'],
    ['#06b6d4', 'jade'],
    ['#B7AFE6', 'slate'],
    ['#d946ef', 'quartz'],
    ['#a855f7', 'lapis'],
    ['#b1b4b9', 'sandstone'],
    ['#f97316', 'terracotta'],
  ])('%s → %s', (hex, stone) => {
    expect(nearestStone(hex)).toBe(stone);
  });

  it('retrouve chaque pierre à partir de sa propre couleur', () => {
    expect(nearestStone('#c8643b')).toBe('terracotta');
    expect(nearestStone('#3a3b3f')).toBe('basalt');
  });

  it('accepte la forme courte, sans dièse ou entourée d’espaces', () => {
    expect(nearestStone('#2c5')).toBe('jade');
    expect(nearestStone(' 3b82f6 ')).toBe('lapis');
  });

  it('renvoie null pour une couleur invalide', () => {
    expect(nearestStone('')).toBeNull();
    expect(nearestStone('vert')).toBeNull();
    expect(nearestStone('#12345')).toBeNull();
  });
});
