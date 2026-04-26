// Iñigo Quilez cosine palettes: col = a + b · cos(2π · (c · t + d)).
// Each palette is [a, b, c, d], each as a 3-tuple. Add new palettes by
// appending to the array; reference indices in REGIMES[].palettes.

export type Palette = [
  [number, number, number], // a — center color
  [number, number, number], // b — color amplitude
  [number, number, number], // c — color frequency per channel
  [number, number, number], // d — phase offset per channel
];

export const PALETTE_NAMES = [
  "hot pink / cyan",
  "gold / magenta / lime",
  "electric blue / yellow",
  "tangerine / cherry / cream",
  "mint / coral / lilac",
  "hot magenta / orange",
] as const;

export const PALETTES: readonly Palette[] = [
  // 0 hot pink / cyan
  [
    [0.5, 0.5, 0.5],
    [0.5, 0.5, 0.5],
    [1.0, 1.0, 1.0],
    [0.0, 0.1, 0.2],
  ],
  // 1 gold / magenta / lime
  [
    [0.55, 0.45, 0.5],
    [0.5, 0.55, 0.45],
    [0.9, 1.0, 0.7],
    [0.45, 0.2, 0.1],
  ],
  // 2 electric blue / yellow
  [
    [0.5, 0.5, 0.5],
    [0.5, 0.5, 0.5],
    [1.0, 1.0, 0.5],
    [0.8, 0.9, 0.3],
  ],
  // 3 tangerine / cherry / cream
  [
    [0.6, 0.4, 0.4],
    [0.4, 0.5, 0.4],
    [1.0, 1.0, 1.0],
    [0.0, 0.25, 0.5],
  ],
  // 4 mint / coral / lilac
  [
    [0.5, 0.5, 0.5],
    [0.4, 0.45, 0.5],
    [0.7, 1.0, 1.0],
    [0.25, 0.3, 0.55],
  ],
  // 5 hot magenta / orange (Studio 54 sign)
  [
    [0.55, 0.4, 0.45],
    [0.45, 0.5, 0.5],
    [2.0, 1.0, 1.0],
    [0.5, 0.2, 0.25],
  ],
];

// Pack a palette into a Float32Array(12) suitable for `gl.uniform3fv`.
export function flatPal(idx: number): Float32Array {
  const p = PALETTES[idx];
  return new Float32Array([...p[0], ...p[1], ...p[2], ...p[3]]);
}
