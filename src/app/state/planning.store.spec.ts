import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PlanningStore } from './planning.store';

describe('PlanningStore — multi-sélection et déplacement par lot', () => {
  let store: PlanningStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(PlanningStore);
  });

  it('gère la sélection simple et multiple tout en gardant selectedId pour un seul élément', () => {
    store.addProject(null, { name: 'P1', charge: 3, persons: 1, mode: 'free', color: 'ochre' });
    store.addProject(null, { name: 'P2', charge: 5, persons: 1, mode: 'free', color: 'lapis' });
    const common = store.commonProjects();
    expect(common.length).toBeGreaterThanOrEqual(2);

    store.select(common[0].id);
    expect(store.selectedIds().size).toBe(1);
    expect(store.selectedId()).toBe(common[0].id);
    expect(store.selected()?.id).toBe(common[0].id);

    store.toggleSelect(common[1].id);
    expect(store.selectedIds().size).toBe(2);
    expect(store.selectedId()).toBeNull();
    expect(store.selected()).toBeNull();

    store.toggleSelect(common[0].id);
    expect(store.selectedIds().size).toBe(1);
    expect(store.selectedId()).toBe(common[1].id);

    store.selectMany([common[0].id, common[1].id]);
    expect(store.selectedIds().size).toBe(2);

    store.select(null);
    expect(store.selectedIds().size).toBe(0);
  });

  it('déplace plusieurs projets vers le bac d’attente d’une équipe en une seule transaction annulable', () => {
    const team = store.teams()[0];
    store.addProject(null, { name: 'T1', charge: 3, persons: 1, mode: 'free', color: 'ochre' });
    store.addProject(null, { name: 'T2', charge: 5, persons: 1, mode: 'free', color: 'lapis' });
    const common = store.commonProjects();
    const ids = common.slice(0, 2).map((p) => p.id);
    store.selectMany(ids);

    store.moveProjectsToTeam(ids, team.id, 'tray');

    expect(store.selectedIds().size).toBe(0);
    for (const id of ids) {
      const moved = store.projects().find((p) => p.id === id)!;
      expect(moved.teamId).toBe(team.id);
      expect(moved.start).toBeNull();
      expect(moved.row).toBeNull();
    }

    store.undo();
    for (const id of ids) {
      const restored = store.projects().find((p) => p.id === id)!;
      expect(restored.teamId).toBeNull();
    }
  });

  it('place plusieurs projets dans le vase d’une équipe sans chevauchement et annule en un Ctrl+Z', () => {
    const team = store.teams()[0];
    store.setWindowWeeks(40);
    store.addProject(null, { name: 'Lot A', charge: 6, persons: 1, mode: 'free', color: 'ochre' });
    store.addProject(null, { name: 'Lot B', charge: 4, persons: 1, mode: 'free', color: 'lapis' });
    const added = store.commonProjects().filter((p) => p.name === 'Lot A' || p.name === 'Lot B');
    const ids = added.map((p) => p.id);

    store.moveProjectsToTeam(ids, team.id, 'place');

    expect(store.selectedIds().size).toBe(0);
    const placed = store.projects().filter((p) => ids.includes(p.id));
    expect(placed.every((p) => p.teamId === team.id && p.start !== null && p.row !== null)).toBe(true);

    // Vérifie qu'aucune paire de briques de l'équipe ne se chevauche.
    const rects = store.projectsOf(team.id).map((p) => store.windowRect(p)).filter((r) => r !== null);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap =
          a.col < b.col + b.weeks &&
          b.col < a.col + a.weeks &&
          a.row < b.row + b.persons &&
          b.row < a.row + a.persons;
        expect(overlap).toBe(false);
      }
    }

    store.undo();
    const restored = store.projects().filter((p) => ids.includes(p.id));
    expect(restored.every((p) => p.teamId === null && p.start === null)).toBe(true);
  });

  it('remet plusieurs projets d’un vase dans le bac commun en une seule transaction annulable', () => {
    const team = store.teams()[0];
    const teamProjects = store.projectsOf(team.id).slice(0, 2);
    expect(teamProjects.length).toBe(2);
    const ids = teamProjects.map((p) => p.id);
    store.selectMany(ids);

    store.moveProjectsToCommon(ids);

    expect(store.selectedIds().size).toBe(0);
    for (const id of ids) {
      const moved = store.projects().find((p) => p.id === id)!;
      expect(moved.teamId).toBeNull();
      expect(moved.start).toBeNull();
      expect(moved.row).toBeNull();
    }

    store.undo();
    for (const orig of teamProjects) {
      const restored = store.projects().find((p) => p.id === orig.id)!;
      expect(restored.teamId).toBe(team.id);
      expect(restored.start).toBe(orig.start);
      expect(restored.row).toBe(orig.row);
    }
  });
});
