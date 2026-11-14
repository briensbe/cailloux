import { demoState } from './demo';
import { overlaps, Rect } from './geometry';
import { effectiveWindowStart, isOverflowing, outsideSide, toWindowRect } from './window';

describe('demo', () => {
  const state = demoState(new Date(2026, 10, 11));
  const start = effectiveWindowStart(state.window, new Date(2026, 10, 11));
  const placed = state.projects
    .map((p) => ({ p, r: toWindowRect(p, start) }))
    .filter((x): x is { p: (typeof state.projects)[number]; r: Rect } => x.r !== null);

  it('ne contient aucun chevauchement ni débordement', () => {
    for (const a of placed) {
      const size = state.teams.find((t) => t.id === a.p.teamId)!.size;
      expect(isOverflowing(a.r, size)).toBe(false);
      for (const b of placed) {
        if (a !== b && a.p.teamId === b.p.teamId) expect(overlaps(a.r, b.r)).toBe(false);
      }
    }
  });

  it('montre un projet commencé, un projet hors fenêtre et un projet en attente', () => {
    expect(placed.some(({ r }) => r.col < 0 && outsideSide(r, state.window.weeks) === null)).toBe(true);
    expect(placed.some(({ r }) => outsideSide(r, state.window.weeks) === 'after')).toBe(true);
    expect(state.projects.some((p) => p.start === null)).toBe(true);
  });
});
