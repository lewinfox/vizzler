// Central registry of all visualizers. Keys must match Regime.visualizer.

import kaleidoscope from "./kaleidoscope/index.ts";
import type { Visualizer } from "./types.ts";

export const VISUALIZERS: Record<string, Visualizer> = {
  kaleidoscope,
};

export const DEFAULT_VISUALIZER = "kaleidoscope";
