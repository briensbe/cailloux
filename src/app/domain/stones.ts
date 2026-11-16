import { StoneColor, STONE_COLORS, STONES } from './model';

type Lab = readonly [l: number, a: number, b: number];

/**
 * Poids de la luminosité dans la distance. Les pierres sont des teintes assez sombres et peu
 * saturées, alors que les couleurs importées sont vives : à poids plein, la luminosité l'emporterait
 * sur la teinte (un vert vif irait vers le Grès, clair, plutôt que vers le Jade).
 */
const LIGHTNESS_WEIGHT = 0.3;

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * La pierre dont la couleur est la plus proche d'une couleur hexadécimale (`#rgb` ou `#rrggbb`),
 * ou `null` si la valeur n'est pas une couleur valide.
 *
 * La distance est mesurée dans l'espace OKLab, conçu pour que des écarts égaux y paraissent
 * égaux à l'œil, ce que l'espace RVB ne garantit pas.
 */
export function nearestStone(hex: string): StoneColor | null {
  const target = toLab(hex.trim());
  if (!target) return null;
  let best: StoneColor = STONE_COLORS[0];
  let bestDistance = Infinity;
  for (const stone of STONE_COLORS) {
    const d = distance(target, STONE_LABS[stone]);
    if (d < bestDistance) {
      best = stone;
      bestDistance = d;
    }
  }
  return best;
}

const STONE_LABS = Object.fromEntries(
  STONE_COLORS.map((s) => [s, toLab(STONES[s].base)!]),
) as Record<StoneColor, Lab>;

function distance(x: Lab, y: Lab): number {
  const dl = (x[0] - y[0]) * LIGHTNESS_WEIGHT;
  return dl * dl + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2;
}

function toLab(hex: string): Lab | null {
  const match = HEX.exec(hex);
  if (!match) return null;
  const digits = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
  const [r, g, b] = [0, 2, 4].map((i) => linear(parseInt(digits.slice(i, i + 2), 16) / 255));
  // Conversion sRGB linéaire → OKLab (Björn Ottosson, 2020).
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Retire la correction gamma du sRGB : les calculs de couleur se font sur une intensité linéaire. */
function linear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
