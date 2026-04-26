// Regime picker — heuristic scoring with thermodynamic bias.
//
// Heat (tension + positive devs) biases toward energetic regimes when high
// and toward chill regimes when low. The current regime is excluded so
// every transition is a real change.
//
// Each regime is classified by *temperament* (chill / balanced / hot /
// sparkly) and the score contribution comes from that, not from the regime
// name. To add a new regime, add it to REGIMES with a temperament that
// matches its visual energy and it'll be picked appropriately.
//
// Spectral matching is layered on top — bass-heavy regimes get extra
// weight when the bass is loud, treble-leaning regimes when the centroid
// is high, etc.

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

// Temperament + spectral preferences per regime. Adding a new regime?
// Add an entry here too — without one the regime falls through to a
// "balanced" default that gets a small constant bonus and no spectral
// preference, so it'll be picked occasionally but isn't favored.
type Temperament = "chill" | "balanced" | "hot" | "sparkly";
interface RegimeProfile {
  temperament: Temperament;
  // Optional spectral matchers — each contributes when its condition is met.
  prefersLoud?: boolean;     // loud absolute volume
  prefersQuiet?: boolean;    // quiet absolute volume
  prefersTreble?: boolean;   // high centroid
  prefersBassDev?: boolean;  // bass-deviation excursive
}

const PROFILES: Record<string, RegimeProfile> = {
  // ---- kaleidoscope ----
  "DISCO FLOOR": { temperament: "hot" },
  "MIRROR BALL": { temperament: "sparkly", prefersTreble: true },
  VORTEX:        { temperament: "hot", prefersLoud: true, prefersBassDev: true },
  "LAVA LAMP":   { temperament: "chill", prefersQuiet: true },
  AURORA:        { temperament: "chill", prefersTreble: true },
};

const DEFAULT_PROFILE: RegimeProfile = { temperament: "balanced" };

function score(
  r: Regime,
  feat: FeatureBus,
  heat: number,
): number {
  const profile = PROFILES[r.name] ?? DEFAULT_PROFILE;
  let s = Math.random() * 0.4; // randomness for variety

  // ---- temperament — main driver. Chill wins when cool, hot wins when warm.
  switch (profile.temperament) {
    case "chill":
      s += 1.4 - heat * 1.6;
      break;
    case "hot":
      s += 0.4 + heat * 1.0;
      break;
    case "sparkly":
      // sparkly is treble-and-energy-driven, somewhat heat-neutral
      s += 0.6 + 0.4 * heat + 0.8 * Math.max(0, feat.centroid.dev);
      break;
    case "balanced":
      // mild constant bonus + small heat lift
      s += 0.7 + 0.3 * heat;
      break;
  }

  // ---- spectral matching — additive bonuses for matching audio character.
  if (profile.prefersLoud) {
    s += 0.8 * Math.max(0, feat.volume.short - 0.3);
  }
  if (profile.prefersQuiet) {
    s += 0.8 * Math.max(0, 0.4 - feat.volume.short);
  }
  if (profile.prefersTreble) {
    s += 0.5 * Math.max(0, feat.centroid.short - 0.4);
  }
  if (profile.prefersBassDev) {
    s += 0.5 * Math.max(0, feat.volume.dev);
  }

  return s;
}

export function pickNextRegime(input: PickerInput): PickResult {
  const { feat, tension, currentIdx } = input;
  const heat =
    tension * 0.5 +
    Math.max(0, feat.volume.dev) * 0.7 +
    Math.max(0, feat.flux.dev) * 0.7 +
    Math.max(0, feat.fullness.dev) * 0.4;

  const scores = REGIMES.map((r, i) => {
    if (i === currentIdx) return -1;
    return score(r, feat, heat);
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
