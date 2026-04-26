// Multi-channel feature bus. Each channel tracks short EMA, long EMA, and
// running |dev| for autoscale; exposes a normalized dev signal in -1..+1.
// Used by tension, novelty, and the regime picker.

import {
  F_SHORT_RATE,
  F_LONG_RATE,
  F_ABSDEV_RATE,
  NOVELTY_FLOOR,
} from "../params.ts";
import { clamp } from "../util.ts";

export interface FeatureChannel {
  raw: number;
  short: number;
  long: number;
  absDev: number;
  dev: number; // (short - long) / (1.5 * absDev), clamped -1..1
}

export function makeChan(): FeatureChannel {
  return { raw: 0, short: 0, long: 0, absDev: 0.05, dev: 0 };
}

export interface FeatureBus {
  volume: FeatureChannel;
  fullness: FeatureChannel;
  centroid: FeatureChannel;
  onsetDensity: FeatureChannel;
  flux: FeatureChannel;
}

export function makeFeatureBus(): FeatureBus {
  return {
    volume: makeChan(),
    fullness: makeChan(),
    centroid: makeChan(),
    onsetDensity: makeChan(),
    flux: makeChan(),
  };
}

export function updateChan(
  ch: FeatureChannel,
  value: number,
  dt: number,
): void {
  ch.raw = value;
  const ks = Math.min(1, dt * F_SHORT_RATE);
  const kl = Math.min(1, dt * F_LONG_RATE);
  const ka = Math.min(1, dt * F_ABSDEV_RATE);
  ch.short += (value - ch.short) * ks;
  ch.long += (value - ch.long) * kl;
  const d = ch.short - ch.long;
  ch.absDev += (Math.abs(d) - ch.absDev) * ka;
  ch.dev = clamp(d / Math.max(ch.absDev * 1.5, 0.04), -1, 1);
}

// Threshold-then-linear: returns 0 when |x| ≤ NOVELTY_FLOOR, scales linearly
// to 1 as |x| → 1. Used by noveltyNow() so steady-state autoscale
// fluctuation contributes nothing.
export function emphasis(x: number): number {
  const a = Math.abs(x);
  if (a <= NOVELTY_FLOOR) return 0;
  return (a - NOVELTY_FLOOR) / (1 - NOVELTY_FLOOR);
}

export function noveltyNow(feat: FeatureBus): number {
  return (
    1.6 * emphasis(feat.volume.dev) +
    1.4 * emphasis(feat.fullness.dev) +
    1.6 * emphasis(feat.flux.dev) +
    1.0 * emphasis(feat.centroid.dev) +
    0.8 * emphasis(feat.onsetDensity.dev)
  );
}
