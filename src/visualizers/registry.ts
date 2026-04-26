// Central registry of all visualizers. When adding a new visualizer:
//   1. Create src/visualizers/<name>/index.ts (default-export a Visualizer)
//   2. Import + add to the VISUALIZERS map below
//   3. Reference its name from regimes (when regimes get a `visualizer` field)
//
// For now there's only one. The current visualizer is just whichever the
// app picks; the regime layer doesn't yet select between visualizers.

import kaleidoscope from "./kaleidoscope/index.ts";
import type { Visualizer } from "./types.ts";

export const VISUALIZERS: Record<string, Visualizer> = {
  kaleidoscope,
};

export const DEFAULT_VISUALIZER = "kaleidoscope";
