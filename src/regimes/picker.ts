// Regime picker — heuristic scoring with thermodynamic bias.
// Heat (tension + positive devs) biases toward energetic regimes when high
// and toward chill regimes when low. The current regime is excluded from
// picks, so every transition is a real change.

import type { FeatureBus } from "../audio/feature-bus.ts";
import { REGIMES, type Regime } from "./index.ts";

export interface PickerInput {
  feat: FeatureBus;
  tension: number;
  currentIdx: number;
}

export interface PickResult {
  idx: number;
  scores: number[];
  heat: number;
}

export function pickNextRegime(input: PickerInput): PickResult {
  const { feat, tension, currentIdx } = input;
  const heat =
    tension * 0.5 +
    Math.max(0, feat.volume.dev) * 0.7 +
    Math.max(0, feat.flux.dev) * 0.7 +
    Math.max(0, feat.fullness.dev) * 0.4;

  const scores = REGIMES.map((r: Regime, i: number) => {
    if (i === currentIdx) return -1;
    let s = Math.random() * 0.4;
    const isChill = r.name === "AURORA" || r.name === "LAVA LAMP";
    const isHot = r.name === "VORTEX" || r.name === "DISCO FLOOR";
    const isSparkly = r.name === "MIRROR BALL";
    if (isChill) s += 1.4 - heat * 1.6;
    if (isHot) s += 0.4 + heat * 1.0;
    if (isSparkly) s += 0.6 + 0.8 * Math.max(0, feat.centroid.dev);
    if (r.name === "VORTEX") s += 0.8 * Math.max(0, feat.volume.short - 0.3);
    if (r.name === "AURORA") s += 0.6 * Math.max(0, feat.centroid.short - 0.4);
    if (r.name === "LAVA LAMP") s += 0.8 * Math.max(0, 0.4 - feat.volume.short);
    return s;
  });

  let best = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] > bestScore) {
      bestScore = scores[i];
      best = i;
    }
  }
  return { idx: best, scores, heat };
}
