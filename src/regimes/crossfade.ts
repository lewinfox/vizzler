// Exponential approach of the current regime params toward target. Called
// once per frame; rate is REGIME_CROSSFADE_RATE.
//
// Generic over the keys: lerps every key in `target`. If `current` lacks
// a key (e.g., target was just set after a same-visualizer switch and
// some keys are new), the key is treated as starting at the target value
// (no jump on the first frame).

import { REGIME_CROSSFADE_RATE } from "../params.ts";
import type { RegimeParams } from "./index.ts";

export function crossfadeRegime(
  current: RegimeParams,
  target: RegimeParams,
  dt: number,
): void {
  const k = 1 - Math.exp(-dt * REGIME_CROSSFADE_RATE);
  for (const key in target) {
    const cur = current[key] ?? target[key];
    current[key] = cur + (target[key] - cur) * k;
  }
}

// Replace all keys of `dst` with the values from `src`. Used when switching
// visualizers — no crossfade, the new params take effect immediately.
export function snapRegime(dst: RegimeParams, src: RegimeParams): void {
  for (const key of Object.keys(dst)) delete dst[key];
  Object.assign(dst, src);
}
