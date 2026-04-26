// Console diagnostics. Boot banner dumps every tweakable param, every
// regime, and every palette into collapsible groups so you can inspect
// the active configuration at a glance.

import * as P from "./params.ts";
import { REGIMES } from "./regimes/index.ts";
import { PALETTES, PALETTE_NAMES } from "./palettes/index.ts";

export function logBoot(): void {
  const title = "color: #ff63c8; font-weight: bold; font-size: 13px;";
  const dim = "color: #888; font-style: italic;";
  const head = "color: #6cf; font-weight: bold;";

  console.log("%cswirly · disco", title);
  console.log(
    "%cmic-reactive viz · open the groups below to see all knobs",
    dim,
  );

  console.groupCollapsed("%c⚙  tweakable params", head);
  console.table({
    SPEC_N: P.SPEC_N,
    ATTACK_SOFT: P.ATTACK_SOFT,
    ATTACK_MED: P.ATTACK_MED,
    RELEASE_OOZE: P.RELEASE_OOZE,
    RELEASE_SLOW: P.RELEASE_SLOW,
    GAIN_DECAY: P.GAIN_DECAY,
    BOUNCE_K: P.BOUNCE_K,
    BOUNCE_D: P.BOUNCE_D,
    F_SHORT_RATE: P.F_SHORT_RATE,
    F_LONG_RATE: P.F_LONG_RATE,
    F_ABSDEV_RATE: P.F_ABSDEV_RATE,
    TENSION_GAIN: P.TENSION_GAIN,
    TENSION_DECAY: P.TENSION_DECAY,
    TENSION_MAX: P.TENSION_MAX,
    LIVE_ATT_RATE: P.LIVE_ATT_RATE,
    LIVE_REL_RATE: P.LIVE_REL_RATE,
    SILENCE_FLOOR: P.SILENCE_FLOOR,
    MUSIC_THRESHOLD: P.MUSIC_THRESHOLD,
    WHITEOUT_MAX: P.WHITEOUT_MAX,
    WHITEOUT_DRAIN_RATE: P.WHITEOUT_DRAIN_RATE,
    WHITEOUT_ATTACK_RATE: P.WHITEOUT_ATTACK_RATE,
    WHITEOUT_RELEASE_RATE: P.WHITEOUT_RELEASE_RATE,
    BRIGHT_FLOOR: P.BRIGHT_FLOOR,
    BRIGHT_RANGE: P.BRIGHT_RANGE,
    BRIGHT_FOLLOW_RATE: P.BRIGHT_FOLLOW_RATE,
    ENERGY_FLOOR: P.ENERGY_FLOOR,
    ENERGY_RANGE: P.ENERGY_RANGE,
    ENERGY_TENSION_BOOST: P.ENERGY_TENSION_BOOST,
    ENERGY_MAX: P.ENERGY_MAX,
    BEAT_FOLLOW_RATE: P.BEAT_FOLLOW_RATE,
    PAL_SWAP_DURATION: P.PAL_SWAP_DURATION,
    REGIME_COOLDOWN_MS: P.REGIME_COOLDOWN_MS,
    NOVELTY_FLOOR: P.NOVELTY_FLOOR,
    NOVELTY_BOIL: P.NOVELTY_BOIL,
    NOVELTY_HEAT_RATE: P.NOVELTY_HEAT_RATE,
    NOVELTY_COOL_RATE: P.NOVELTY_COOL_RATE,
    NOVELTY_THRESHOLD: P.NOVELTY_THRESHOLD,
    NOVELTY_MAX: P.NOVELTY_MAX,
    REGIME_CROSSFADE_RATE: P.REGIME_CROSSFADE_RATE,
    SWITCH_FLASH_DECAY: P.SWITCH_FLASH_DECAY,
    SEGMENTS_DRIFT_MS: P.SEGMENTS_DRIFT_MS,
  });
  console.log("Range params (smoothstep [lo, hi]):", {
    WHITEOUT_VOL_GATE: P.WHITEOUT_VOL_GATE,
    WHITEOUT_FULL_GATE: P.WHITEOUT_FULL_GATE,
    WHITEOUT_LOUD_GATE: P.WHITEOUT_LOUD_GATE,
    WHITEOUT_TENSION_GATE: P.WHITEOUT_TENSION_GATE,
    BRIGHT_SIG: P.BRIGHT_SIG,
    BEAT_PRESENCE_RANGE: P.BEAT_PRESENCE_RANGE,
  });
  console.log("ONSET_DECAY (per-band tail decay rate, 1/s):", P.ONSET_DECAY);
  console.groupEnd();

  console.groupCollapsed(
    `%c🎨 regimes (${REGIMES.length})`,
    "color: #ffd166; font-weight: bold;",
  );
  console.table(
    REGIMES.map((r, i) => ({
      idx: i,
      name: r.name,
      visualizer: r.visualizer,
      ...r.p,
      palettes: r.palettes.join(","),
    })),
  );
  console.groupEnd();

  console.groupCollapsed(
    `%c🌈 palettes (${PALETTES.length})  · IQ cosine: a + b·cos(2π·(c·t + d))`,
    "color: #6f6; font-weight: bold;",
  );
  PALETTES.forEach((p, i) => {
    console.log(
      `[${i}] ${PALETTE_NAMES[i] ?? ""}`,
      "\n  a:",
      p[0],
      "\n  b:",
      p[1],
      "\n  c:",
      p[2],
      "\n  d:",
      p[3],
    );
  });
  console.groupEnd();

  console.log(
    "%c→ regime switches and whiteout fires logged below as they happen",
    dim,
  );
}
