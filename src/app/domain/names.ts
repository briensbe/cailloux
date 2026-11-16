/**
 * Identité des projets par leur nom.
 *
 * Deux projets sont le même projet quand leurs noms ne diffèrent que par la casse ou par des
 * espaces. C'est la seule règle de rapprochement de l'application : tout import (Excel, et plus
 * tard les exports JSON de planification) doit passer par `nameKey`.
 */

/** Nom stocké : écriture Unicode unifiée (NFC), sans espaces au début ni à la fin. */
export function cleanName(name: string): string {
  return name.normalize('NFC').trim();
}

/**
 * Clé de comparaison d'un nom de projet : NFC, espaces (y compris insécables) réduits à un seul,
 * bords retirés, minuscules. Les accents sont gardés : « Etude » et « Étude » restent distincts.
 *
 * La NFC rend identiques deux écritures invisiblement différentes d'un même caractère :
 * « é » peut être codé en un seul point (U+00E9) ou en « e » + accent combinant (U+0301).
 */
export function nameKey(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('fr-FR');
}

/**
 * Clé de comparaison d'un en-tête de colonne : comme `nameKey`, mais sans les accents.
 * « Référence Externe » et « reference  externe » désignent la même colonne.
 */
export function headerKey(header: string): string {
  const withoutAccents = header.normalize('NFD').replace(/\p{M}/gu, '');
  return nameKey(withoutAccents);
}
