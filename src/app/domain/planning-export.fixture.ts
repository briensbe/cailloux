// Jeu d'essai des tests de l'import de planification. N'est importé que par des fichiers `.spec.ts`.

/** Un petit export, sur le modèle des fichiers réels (vue « resource »). */
export function sampleExport() {
  const planif = (semaine: string, jours: number, commentaire: string | null = null) => ({
    semaine,
    jours,
    commentaire,
  });
  const project = (
    nom: string,
    equipe: string | null,
    charges: Record<string, number>,
    extra: object = {},
  ) => ({
    id: nom,
    code: '2026_007',
    referenceExterne: null,
    nom,
    statut: 'En cours',
    chefProjet: 'Martin Lerbier',
    couleur: '#22c55e',
    chiffres: { initial: 155, revise: 0, previsionnel: 155, consomme: 0, restant: 155 },
    jalons: [],
    chargesParSemaine: charges,
    equipes:
      equipe === null
        ? []
        : [
            {
              nom: equipe,
              ressources: [
                {
                  type: 'role',
                  planifications: Object.entries(charges).map(([s, j]) => planif(s, j)),
                },
              ],
            },
          ],
    ...extra,
  });
  return {
    metadonnees: { periode: { dateDebut: '2026-10-26' } },
    synthese: {},
    projets: [
      project(
        ' C Bourse - Offre ACCESS',
        'Artémis',
        { '2026-11-09': 0.5, '2026-11-16': 1, '2026-12-07': 1 },
        {
          equipes: [
            {
              nom: 'Artémis',
              ressources: [
                {
                  planifications: [
                    planif('2026-12-07', 1, 'Accessibilité'),
                    planif('2026-11-16', 1),
                  ],
                },
              ],
            },
          ],
        },
      ),
      project(
        'C BOURSE - Souscription PIP ETF Selfcare',
        'Aurora',
        {},
        {
          chiffres: { restant: 61, previsionnel: 250 },
          couleur: '#3b82f6',
        },
      ),
      project(
        'Maintenance',
        'Artémis',
        { '2026-12-07': 0.3, '2027-01-04': 0.3 },
        { code: null, chefProjet: null },
      ),
    ],
    equipes: [{ nom: 'Artémis' }, { nom: 'Aurora' }],
  };
}
