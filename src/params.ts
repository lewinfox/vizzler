// ═══════════════════════════════════════════════════════════════════════
// TWEAKABLE PARAMETERS
//
// Every knob that meaningfully affects the FEEL of the viz lives here.
// Change a value, save, and the dev server picks it up.
//
// If you only tweak one thing, it should usually be one of:
//   - F_LONG_RATE              (how reactive everything is)
//   - SILENCE_FLOOR / MUSIC_THRESHOLD  (when the room "wakes up")
//   - WHITEOUT_*_GATE          (how rare whiteouts are)
//   - NOVELTY_THRESHOLD        (how often regimes switch)
//   - PALETTES, REGIMES        (the actual content — in their own modules)
// ═══════════════════════════════════════════════════════════════════════

// ---- Spectrum texture ----
// 1-row R8 texture sent to the kaleidoscope shader for sunburst rays.
// 32 = chunky, 64 = balanced, 128 = silky but more bandwidth.
export const SPEC_N = 64;

// ---- Audio band envelopes (per-frame followers) ----
// Used in follow(prev, target, attack, release) on the auto-gained bands.
// Per-frame multipliers, NOT dt-corrected. Higher = snappier.
export const ATTACK_SOFT = 0.08; // attack on bass/mid/vol — viscous
export const ATTACK_MED = 0.14; // attack on hi — slightly snappier
export const RELEASE_OOZE = 0.012; // very slow release on bass/vol
export const RELEASE_SLOW = 0.025; // medium release on mid/hi

// ---- Auto-gain (per-band running max normalizer) ----
export const GAIN_DECAY = 0.9985; // ~7s peak memory at 60fps

// ---- Onset envelope decay ----
export const ONSET_DECAY = { bass: 2.2, mid: 2.6, hi: 3.2 };

// ---- Bouncy bass spring ----
// ω₀ = √K, ζ = D / (2√K). K=90 → 1.5 Hz; ζ ≈ 0.34 underdamped, ~2s ring.
export const BOUNCE_K = 90;
export const BOUNCE_D = 6.5;

// ---- Feature bus EMAs ----
// dev = (short - long) / max(absDev * 1.5, 0.04), clamped -1..+1.
// F_LONG_RATE is the most consequential knob. Sane range 0.05..0.20.
export const F_SHORT_RATE = 2.5; // 1/s — short EMA settle ~0.4s
export const F_LONG_RATE = 0.05; // 1/s — long EMA settle ~20s
export const F_ABSDEV_RATE = 0.3; // 1/s — autoscale window ~3s

// ---- Tension accumulator ----
export const TENSION_GAIN = 0.22;
export const TENSION_DECAY = 0.2; // 1/s — ~5s decay
export const TENSION_MAX = 2.0;

// ---- Liveness gate (master "is anything actually playing") ----
export const LIVE_ATT_RATE = 1.5; // 1/s — ~0.7s come-on
export const LIVE_REL_RATE = 0.33; // 1/s — ~3s fall-off
export const SILENCE_FLOOR = 0.04;
export const MUSIC_THRESHOLD = 0.2;

// ---- Whiteout gates (4-way AND, drains tension on fire) ----
export const WHITEOUT_VOL_GATE: [number, number] = [0.82, 1.0];
export const WHITEOUT_FULL_GATE: [number, number] = [0.78, 1.0];
export const WHITEOUT_LOUD_GATE: [number, number] = [0.62, 0.92];
export const WHITEOUT_TENSION_GATE: [number, number] = [1.45, 2.0];
export const WHITEOUT_MAX = 0.32;
export const WHITEOUT_DRAIN_RATE = 1.6;
export const WHITEOUT_ATTACK_RATE = 6.0;
export const WHITEOUT_RELEASE_RATE = 0.9;

// ---- Brightness / energy sigmoid ----
export const BRIGHT_FLOOR = 0.12;
export const BRIGHT_RANGE = 0.66;
export const BRIGHT_SIG: [number, number] = [0.04, 0.55];
export const BRIGHT_FOLLOW_RATE = 2.5;
export const ENERGY_FLOOR = 0.18;
export const ENERGY_RANGE = 0.62;
export const ENERGY_TENSION_BOOST = 0.1;
export const ENERGY_MAX = 1.05;

// ---- Beat presence ----
export const BEAT_PRESENCE_RANGE: [number, number] = [0.6, 2.6];
export const BEAT_FOLLOW_RATE = 1.2;

// ---- Regimes & palette swaps ----
export const PAL_SWAP_DURATION = 1.6;
export const REGIME_COOLDOWN_MS = 5000;
export const NOVELTY_FLOOR = 0.65;
export const NOVELTY_BOIL = 1.0;
export const NOVELTY_HEAT_RATE = 0.3;
export const NOVELTY_COOL_RATE = 0.4;
export const NOVELTY_THRESHOLD = 0.85;
export const NOVELTY_MAX = 3.0;
export const REGIME_CROSSFADE_RATE = 1.1;
export const SWITCH_FLASH_DECAY = 1.5;

// ---- Misc timings ----
export const SEGMENTS_DRIFT_MS = 22000;
