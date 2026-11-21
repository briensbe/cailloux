import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PlanningStore } from './planning.store';
import { ToastService } from './toast.service';

describe('PlanningStore — multi-sélection et déplacement par lot', () => {
  let store: PlanningStore;
  let toast: ToastService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(PlanningStore);
    toast = TestBed.inject(ToastService);
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

  it('applique un lot de placements calculés par drag & drop et le met en attente si cell est null', () => {
    const team = store.teams()[0];
    store.addProject(null, { name: 'G1', charge: 4, persons: 1, mode: 'free', color: 'ochre' });
    store.addProject(null, { name: 'G2', charge: 2, persons: 1, mode: 'free', color: 'lapis' });
    const [g1, g2] = store.commonProjects().filter((p) => p.name === 'G1' || p.name === 'G2');
    store.selectMany([g1.id, g2.id]);

    store.placeProjectsInTeam(team.id, [
      { project: g1, cell: { col: 0, row: 0 }, dims: { weeks: g1.weeks, persons: g1.persons, charge: g1.charge } },
      { project: g2, cell: null, dims: { weeks: g2.weeks, persons: g2.persons, charge: g2.charge } },
    ]);

    expect(store.selectedIds().size).toBe(0);
    const updated1 = store.projects().find((p) => p.id === g1.id)!;
    const updated2 = store.projects().find((p) => p.id === g2.id)!;
    expect(updated1.teamId).toBe(team.id);
    expect(updated1.start).not.toBeNull();
    expect(updated1.row).toBe(0);
    expect(updated2.teamId).toBe(team.id);
    expect(updated2.start).toBeNull();
    expect(updated2.row).toBeNull();

    store.undo();
    expect(store.projects().find((p) => p.id === g1.id)?.teamId).toBeNull();
    expect(store.projects().find((p) => p.id === g2.id)?.teamId).toBeNull();
  });

  it('supprime plusieurs projets en une seule transaction annulable et nettoie la sélection', () => {
    store.addProject(null, { name: 'S1', charge: 3, persons: 1, mode: 'fixed', color: 'ochre' });
    store.addProject(null, { name: 'S2', charge: 5, persons: 1, mode: 'fixed', color: 'lapis' });
    const [s1, s2] = store.commonProjects().filter((p) => p.name === 'S1' || p.name === 'S2');
    store.selectMany([s1.id, s2.id]);
    const beforeCount = store.projects().length;

    store.removeProjects([s1.id, s2.id]);

    expect(store.projects().length).toBe(beforeCount - 2);
    expect(store.selectedIds().size).toBe(0);

    store.undo();
    expect(store.projects().length).toBe(beforeCount);
    expect(store.projects().some((p) => p.id === s1.id)).toBe(true);
    expect(store.projects().some((p) => p.id === s2.id)).toBe(true);
  });

  it("n'affiche pas de toast d'annulation lors d'un déplacement au sein du même vase", () => {
    const team = store.teams()[0];
    const [p1, p2] = store.projectsOf(team.id);
    expect(toast.toasts().length).toBe(0);

    store.placeProjectsInTeam(team.id, [
      { project: p1, cell: { col: 10, row: 0 }, dims: { weeks: p1.weeks, persons: p1.persons, charge: p1.charge } },
      { project: p2, cell: { col: 10, row: 2 }, dims: { weeks: p2.weeks, persons: p2.persons, charge: p2.charge } },
    ]);
    expect(toast.toasts().length).toBe(0);

    const otherTeam = store.teams()[1];
    store.placeProjectsInTeam(otherTeam.id, [
      { project: p1, cell: { col: 10, row: 0 }, dims: { weeks: p1.weeks, persons: p1.persons, charge: p1.charge } },
    ]);
    expect(toast.toasts().length).toBe(1);
    expect(toast.toasts()[0].action?.label).toBe('Annuler');
  });
});
