import { describeLoad, parsePlanningExport } from './planning-export';
import { sampleExport } from './planning-export.fixture';

describe('planning-export', () => {
  it('lit les équipes et les projets', () => {
    const exp = parsePlanningExport(sampleExport())!;
    expect(exp.teams).toEqual(['Artémis', 'Aurora']);
    expect(exp.projects.map((p) => [p.name, p.team])).toEqual([
      ['C Bourse - Offre ACCESS', 'Artémis'],
      ['C BOURSE - Souscription PIP ETF Selfcare', 'Aurora'],
      ['Maintenance', 'Artémis'],
    ]);
  });

  it('garde les charges par semaine, le restant et la couleur', () => {
    const [access, pip] = parsePlanningExport(sampleExport())!.projects;
    expect(access.load).toEqual({ '2026-11-09': 0.5, '2026-11-16': 1, '2026-12-07': 1 });
    expect(pip.load).toEqual({});
    expect(pip.remaining).toBe(61);
    expect(pip.color).toBe('#3b82f6');
  });

  it('construit des métadonnées lisibles, sans valeurs vides', () => {
    const [access, , maintenance] = parsePlanningExport(sampleExport())!.projects;
    expect(access.meta).toEqual({
      'Code Projet': '2026_007',
      Statut: 'En cours',
      'Chef de Projet': 'Martin Lerbier',
      Couleur: '#22c55e',
      Chiffres: 'initial 155 · révisé 0 · prévisionnel 155 · consommé 0 · restant 155',
      Commentaires: '07/12 : Accessibilité',
    });
    expect(maintenance.meta['Code Projet']).toBeUndefined();
    expect(maintenance.meta['Chef de Projet']).toBeUndefined();
  });

  it('ramène une semaine au lundi et écarte les charges nulles ou invalides', () => {
    const data = sampleExport();
    data.projets[2].chargesParSemaine = {
      '2026-12-09': 1,
      '2026-12-14': 0,
      '2026-12-21': -1,
      pasunedate: 2,
    } as never;
    expect(parsePlanningExport(data)!.projects[2].load).toEqual({ '2026-12-07': 1 });
  });

  it('ignore un projet sans nom et ne garde que le premier de deux noms identiques', () => {
    const data = sampleExport();
    data.projets.push(
      { ...data.projets[2], nom: '  ' },
      { ...data.projets[2], nom: 'maintenance ', code: 'autre' },
    );
    const exp = parsePlanningExport(data)!;
    expect(exp.projects.map((p) => p.name)).toEqual([
      'C Bourse - Offre ACCESS',
      'C BOURSE - Souscription PIP ETF Selfcare',
      'Maintenance',
    ]);
  });

  it("accepte un projet sans équipe et ajoute l'équipe d'un projet absente de la liste", () => {
    const data = sampleExport();
    data.projets[2].equipes = [];
    data.projets[1].equipes = [{ nom: 'BRSU', ressources: [] }];
    const exp = parsePlanningExport(data)!;
    expect(exp.projects[2].team).toBeNull();
    expect(exp.teams).toEqual(['Artémis', 'Aurora', 'BRSU']);
  });

  it("refuse un JSON qui n'est pas un export de planification", () => {
    expect(parsePlanningExport({ foo: 1 })).toBeNull();
    expect(parsePlanningExport([])).toBeNull();
    expect(parsePlanningExport(null)).toBeNull();
    expect(parsePlanningExport({ projets: [], equipes: 'non' })).toBeNull();
  });

  it('décrit une répartition de charge', () => {
    expect(describeLoad({ '2026-12-14': 0.5, '2026-12-07': 1 })).toBe(
      '07/12 : 1 · 14/12 : 0,5 (2 semaines, 1,5 j)',
    );
  });
});
