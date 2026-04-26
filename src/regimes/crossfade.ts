// Exponential approach of the current regime params toward target. Called
// once per frame; the rate constant (REGIME_CROSSFADE_RATE) controls how
// quickly the visual settles into the new regime.

import { REGIME_CROSSFADE_RATE } from "../params.ts";
import { PARAM_KEYS, type RegimeParams } from "./index.ts";

export function crossfadeRegime(
  current: RegimeParams,
  target: RegimeParams,
  dt: number,
): void {
  const k = 1 - Math.exp(-dt * REGIME_CROSSFADE_RATE);
  for (const key of PARAM_KEYS) {
    current[key] += (target[key] - current[key]) * k;
  }
}
