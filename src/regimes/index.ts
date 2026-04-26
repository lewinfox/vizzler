// Regimes are bundles of visualizer-specific coefficients + a target
// visualizer + a list of preferred palette indices. They crossfade smoothly
// on switch within the same visualizer; visualizer-changing switches snap.
//
// Each visualizer interprets `p` according to its own schema. To add a
// regime targeting a particular visualizer, look at that visualizer's
// PARAM_DEFAULTS for the keys it understands.

export type RegimeParams = Record<string, number>;

export interface Regime {
  name: string;
  visualizer: string; // matches a key in VISUALIZERS
  p: RegimeParams;
  palettes: number[]; // indices into PALETTES
}

export const REGIMES: readonly Regime[] = [
  // ---- kaleidoscope regimes ----
  {
    name: "DISCO FLOOR",
    visualizer: "kaleidoscope",
    p: { segOff: 0, twist: 1.0, warp: 1.0, rings: 1.0, sparkle: 1.0, rays: 1.0, hue: 0.0 },
    palettes: [0, 2, 5],
  },
  {
    name: "MIRROR BALL",
    visualizer: "kaleidoscope",
    p: { segOff: 2, twist: 0.5, warp: 0.6, rings: 0.3, sparkle: 2.6, rays: 1.5, hue: 0.1 },
    palettes: [0, 4],
  },
  {
    name: "VORTEX",
    visualizer: "kaleidoscope",
    p: { segOff: -2, twist: 2.4, warp: 1.6, rings: 1.5, sparkle: 0.3, rays: 1.8, hue: 0.4 },
    palettes: [3, 5],
  },
  {
    name: "LAVA LAMP",
    visualizer: "kaleidoscope",
    p: { segOff: -2, twist: 1.4, warp: 2.0, rings: 0.5, sparkle: 0.0, rays: 0.3, hue: 0.55 },
    palettes: [3],
  },
  {
    name: "AURORA",
    visualizer: "kaleidoscope",
    p: { segOff: 4, twist: 0.7, warp: 0.8, rings: 0.7, sparkle: 1.8, rays: 0.6, hue: 0.7 },
    palettes: [4, 1],
  },

];
