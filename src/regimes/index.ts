// Regimes are bundles of visualizer-shape coefficients + a list of preferred
// palette indices. They crossfade smoothly on switch (see crossfade.ts).
//
// The seven coefficient names below are kaleidoscope-specific. When we add
// more visualizer types, regimes will need a `visualizer` field too — for
// now there's only one visualizer so this is implicit.

export interface RegimeParams {
  segOff: number;
  twist: number;
  warp: number;
  rings: number;
  sparkle: number;
  rays: number;
  hue: number;
}

export interface Regime {
  name: string;
  p: RegimeParams;
  palettes: number[]; // indices into PALETTES that this regime prefers
}

export const REGIMES: readonly Regime[] = [
  {
    name: "DISCO FLOOR",
    p: { segOff: 0, twist: 1.0, warp: 1.0, rings: 1.0, sparkle: 1.0, rays: 1.0, hue: 0.0 },
    palettes: [0, 2, 5],
  },
  {
    name: "MIRROR BALL",
    p: { segOff: 2, twist: 0.5, warp: 0.6, rings: 0.3, sparkle: 2.6, rays: 1.5, hue: 0.1 },
    palettes: [0, 4],
  },
  {
    name: "VORTEX",
    p: { segOff: -2, twist: 2.4, warp: 1.6, rings: 1.5, sparkle: 0.3, rays: 1.8, hue: 0.4 },
    palettes: [3, 5],
  },
  {
    name: "LAVA LAMP",
    p: { segOff: -2, twist: 1.4, warp: 2.0, rings: 0.5, sparkle: 0.0, rays: 0.3, hue: 0.55 },
    palettes: [3],
  },
  {
    name: "AURORA",
    p: { segOff: 4, twist: 0.7, warp: 0.8, rings: 0.7, sparkle: 1.8, rays: 0.6, hue: 0.7 },
    palettes: [4, 1],
  },
];

export const PARAM_KEYS: readonly (keyof RegimeParams)[] = [
  "segOff",
  "twist",
  "warp",
  "rings",
  "sparkle",
  "rays",
  "hue",
];
