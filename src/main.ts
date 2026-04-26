// ═══════════════════════════════════════════════════════════════════════
// SWIRLY · DISCO  — orchestrator
//
// SIGNAL FLOW (audio → pixels):
//
//   mic → AnalyserNode   → freq bytes → bands → auto-gain
//                                          ↓
//   mic → AudioWorklet   → IIR bandpass → flux → onset events
//                                          ↓
//   liveness gate (absolute volume sigmoid) — calms everything in silence
//                                          ↓
//   feature bus (volume / fullness / centroid / onsetDensity / flux):
//     each = { short EMA, long EMA, autoscaled deviation }
//                                          ↓
//   tension accumulator (charges from positive devs, drains on whiteout)
//                                          ↓
//   derived state:
//     uBrightness  — sigmoid of (absVol ↔ volN by liveness)
//     uEnergy      — same + tension boost
//     uWhiteout    — 4-way AND-gated (vol/full/loud/tension)
//     uBeatPresence — smoothed onset density
//   regime params (segOff/twist/warp/rings/sparkle/rays/hue) crossfade
//   palette crossfade (two IQ palettes lerped by palMix)
//                                          ↓
//   active visualizer renders one frame
//
// All knobs in src/params.ts.
// ═══════════════════════════════════════════════════════════════════════

import * as P from "./params.ts";
import { clamp, follow, smoothstep01 } from "./util.ts";

import {
  startAudio,
  getAudioCtx,
  getFreq,
  getAnalyser,
  band,
  autoGain,
  type OnsetEvent,
} from "./audio/analyser.ts";
import {
  makeFeatureBus,
  noveltyNow,
  updateChan,
} from "./audio/feature-bus.ts";
import { computeCentroid } from "./audio/centroid.ts";
import { SpectrumTexture, SpectralFlux } from "./audio/spectrum.ts";
import {
  recordOnsetEvent,
  onsetDensityNow,
} from "./audio/onset-density.ts";

import { REGIMES, type RegimeParams } from "./regimes/index.ts";
import { pickNextRegime } from "./regimes/picker.ts";
import { crossfadeRegime, snapRegime } from "./regimes/crossfade.ts";

import { flatPal } from "./palettes/index.ts";
import { makeColorMap, randomizeColorMap } from "./palettes/color-map.ts";

import { VISUALIZERS, DEFAULT_VISUALIZER } from "./visualizers/registry.ts";
import type { RenderContext } from "./visualizers/types.ts";

import { updateHud, setRegimeLabel } from "./ui/hud.ts";
import { pushDash, drawDash } from "./ui/dashboard.ts";
import { hideWelcomeCard, onUserGesture } from "./ui/welcome.ts";

import { logBoot } from "./boot-log.ts";

// ---- canvas + GL ----
const canvas = document.getElementById("c") as HTMLCanvasElement;
const glOrNull = canvas.getContext("webgl2", {
  antialias: false,
  alpha: false,
  premultipliedAlpha: false,
});
if (!glOrNull) {
  document.body.innerHTML =
    "<p style='padding:20px'>WebGL2 unavailable.</p>";
  throw new Error("no webgl2");
}
const gl: WebGL2RenderingContext = glOrNull;

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(innerWidth * dpr);
  const h = Math.floor(innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.viewport(0, 0, w, h);
}
resize();
addEventListener("resize", resize);

// ---- shared spectrum + flux ----
const spectrum = new SpectrumTexture(gl);
const fluxTracker = new SpectralFlux();

// ---- visualizer (mutable — switches on cross-visualizer regime changes) ----
let visualizerName = DEFAULT_VISUALIZER;
let visualizer = VISUALIZERS[visualizerName];
let vizState: unknown = visualizer.init(gl);

// ---- audio state ----
const env = { bass: 0, mid: 0, hi: 0, vol: 0 };
const raw = { bass: 0, mid: 0, hi: 0 };
const onset = { bass: 0, mid: 0, hi: 0 };
let bounceY = 0;
let bounceV = 0;
let beatPhase = 0;
let beatPhaseSmooth = 0;
let slowPhase = 0;
let centroidSmooth = 0.5;
let segments = 6;
let segmentDriftAt = 0;

// liveness
let absVolSmooth = 0;
let liveness = 0;

// feature bus + tension + sustained novelty
const feat = makeFeatureBus();
let tension = 0;
let sustainedNovelty = 0;

// derived display values that go into uniforms
let uBrightnessVal = 0.2;
let uEnergyVal = 0.2;
let uWhiteoutVal = 0;
let uBeatPresenceVal = 0;

// diagnostic edge-trigger state
let _whiteoutWasFiring = false;
let _liveState: "idle" | "live" | "silent" = "idle";

// ---- color mapping + palettes ----
const colorMap = makeColorMap();
randomizeColorMap(colorMap);
let palCurIdx = 0;
let palNextIdx = 1;
let palCur = flatPal(palCurIdx);
let palNext = flatPal(palNextIdx);
let palMix = 1;

function swapPaletteTo(idx: number): void {
  if (idx === palCurIdx) return;
  palNextIdx = idx;
  palNext = flatPal(palNextIdx);
  palMix = 0;
}

// ---- regime state ----
let regimeIdx = Math.floor(Math.random() * REGIMES.length);
const regimeCur: RegimeParams = { ...REGIMES[regimeIdx].p };
const regimeTarget: RegimeParams = { ...REGIMES[regimeIdx].p };
let lastRegimeSwitchAt = -100000;
let switchFlash = 0;
setRegimeLabel(REGIMES[regimeIdx].name);

// If the random initial regime targets a different visualizer than the
// default, swap to it before the first frame runs.
if (REGIMES[regimeIdx].visualizer !== visualizerName) {
  visualizer.dispose?.(gl, vizState);
  visualizerName = REGIMES[regimeIdx].visualizer;
  visualizer = VISUALIZERS[visualizerName];
  if (!visualizer) {
    console.warn(`unknown visualizer "${visualizerName}", falling back`);
    visualizerName = DEFAULT_VISUALIZER;
    visualizer = VISUALIZERS[visualizerName];
  }
  vizState = visualizer.init(gl);
}

// Apply a regime switch to a specific target index. Used by both the
// automatic novelty-driven path and the manual "n" keyboard shortcut.
// `auto` carries picker telemetry for the console log; absent when the
// switch is forced manually.
interface AutoSwitchInfo {
  scores: number[];
  heat: number;
  novInstant: number;
}

function switchRegime(next: number, now: number, auto?: AutoSwitchInfo): void {
  const prevName = REGIMES[regimeIdx].name;
  const newRegime = REGIMES[next];

  // ---- log the decision ----
  const banner = auto
    ? `%c⚡ regime: ${prevName} → ${newRegime.name}`
    : `%c↳ manual regime: ${prevName} → ${newRegime.name}`;
  console.groupCollapsed(banner, "color: #ffd166; font-weight: bold;");
  if (auto) {
    const drive = Math.max(0, auto.novInstant - P.NOVELTY_BOIL);
    console.log(
      `sustained: ${sustainedNovelty.toFixed(3)}  (threshold ${P.NOVELTY_THRESHOLD})  ·  instant: ${auto.novInstant.toFixed(2)}  ·  drive: ${drive.toFixed(2)}  (boil ${P.NOVELTY_BOIL})`,
    );
    console.log(
      `liveness: ${liveness.toFixed(2)}   tension: ${tension.toFixed(2)}   heat: ${auto.heat.toFixed(2)}`,
    );
    console.log("dev snapshot (short - long, normalized to ±1):", {
      volume: +feat.volume.dev.toFixed(2),
      fullness: +feat.fullness.dev.toFixed(2),
      flux: +feat.flux.dev.toFixed(2),
      centroid: +feat.centroid.dev.toFixed(2),
      onsetDensity: +feat.onsetDensity.dev.toFixed(2),
    });
    console.table(
      REGIMES.map((r, i) => ({
        regime: r.name,
        score: auto.scores[i] === -1 ? "(current)" : +auto.scores[i].toFixed(3),
        picked: i === next ? "★" : "",
      })),
    );
  } else {
    console.log("triggered by keyboard ('n' — uniform random)");
  }
  console.groupEnd();

  // ---- apply the switch ----
  regimeIdx = next;
  lastRegimeSwitchAt = now;
  switchFlash = 1;

  // Cross-visualizer switch: dispose the old viz, init the new one, snap
  // params (no crossfade — different visualizers wouldn't lerp meaningfully).
  if (newRegime.visualizer !== visualizerName) {
    console.log(
      `%c↻ visualizer: ${visualizerName} → ${newRegime.visualizer}`,
      "color: #6cf; font-weight: bold;",
    );
    visualizer.dispose?.(gl, vizState);
    visualizerName = newRegime.visualizer;
    visualizer = VISUALIZERS[visualizerName] ?? VISUALIZERS[DEFAULT_VISUALIZER];
    vizState = visualizer.init(gl);
    snapRegime(regimeCur, newRegime.p);
    snapRegime(regimeTarget, newRegime.p);
  } else {
    // Same visualizer — replace target so crossfade approaches the new params.
    snapRegime(regimeTarget, newRegime.p);
  }

  const choices = newRegime.palettes.filter((i) => i !== palCurIdx);
  const pick = choices.length
    ? choices[(Math.random() * choices.length) | 0]
    : newRegime.palettes[0];
  swapPaletteTo(pick);
  randomizeColorMap(colorMap);
  setRegimeLabel(newRegime.name);
}

// Manual switch: pick any regime other than the current one with uniform
// probability (bypasses heuristic scoring AND the cooldown). Resets
// sustainedNovelty so we don't immediately retrigger on the next frame.
function manualSwitchRegime(): void {
  if (REGIMES.length < 2) return;
  // index in [0, REGIMES.length - 1) → shift past current to ensure we pick a different one
  let pick = Math.floor(Math.random() * (REGIMES.length - 1));
  if (pick >= regimeIdx) pick++;
  switchRegime(pick, performance.now());
  sustainedNovelty = 0;
}

// ---- onset handler ----
function handleOnset(e: OnsetEvent): void {
  const s = clamp(e.strength, 0, 1) * liveness;
  if (s < 0.05) return; // silence — drop
  onset[e.band] = Math.max(onset[e.band], s);
  recordOnsetEvent(performance.now());
  if (e.band === "bass") {
    bounceV += 5.5 * (0.4 + s);
    beatPhase += 0.18 + s * 0.25;
  }
}

// ---- frame loop ----
const t0 = performance.now();
let lastFrame = t0;

function frame(now: number): void {
  const t = (now - t0) / 1000;
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  const analyser = getAnalyser();
  const freq = getFreq();
  let bass = 0;
  let mid = 0;
  let hi = 0;
  if (analyser && freq) {
    analyser.getByteFrequencyData(freq);
    bass = band(1, 4); // ~94..375 Hz
    mid = band(4, 25); // ~375..2344 Hz
    hi = band(25, 90); // ~2344..8438 Hz
  }
  // liveness from absolute (pre-shape) volume
  const absVolRaw = (bass + mid + hi) / 3;
  const liveK = absVolRaw > absVolSmooth ? P.LIVE_ATT_RATE : P.LIVE_REL_RATE;
  absVolSmooth += (absVolRaw - absVolSmooth) * Math.min(1, dt * liveK);
  liveness = smoothstep01(P.SILENCE_FLOOR, P.MUSIC_THRESHOLD, absVolSmooth);

  // log live/silent transitions
  if (liveness > 0.6 && _liveState !== "live") {
    console.log(
      "%c♪ room is LIVE",
      "color: #6cf; font-weight: bold;",
      `liveness ${liveness.toFixed(2)}, absVol ${absVolSmooth.toFixed(3)}`,
    );
    _liveState = "live";
  } else if (liveness < 0.2 && _liveState !== "silent") {
    console.log(
      "%c· room went silent",
      "color: #888;",
      `liveness ${liveness.toFixed(2)}, absVol ${absVolSmooth.toFixed(3)}`,
    );
    _liveState = "silent";
  }

  bass = Math.pow(bass, 0.85) * 1.3;
  const bassN = autoGain("bass", bass);
  const midN = autoGain("mid", mid);
  const hiN = autoGain("hi", hi);
  const volN = (bassN + midN + hiN) / 3;

  raw.bass = bassN;
  raw.mid = midN;
  raw.hi = hiN;

  env.bass = follow(env.bass, bassN, P.ATTACK_SOFT, P.RELEASE_OOZE);
  env.mid = follow(env.mid, midN, P.ATTACK_SOFT, P.RELEASE_SLOW);
  env.hi = follow(env.hi, hiN, P.ATTACK_MED, P.RELEASE_SLOW);
  env.vol = follow(env.vol, volN, P.ATTACK_SOFT, P.RELEASE_OOZE);

  // onset tail decay
  for (const k of ["bass", "mid", "hi"] as const) {
    onset[k] = Math.max(0, onset[k] * (1 - dt * P.ONSET_DECAY[k]));
  }

  // bouncy bass spring
  bounceV += -P.BOUNCE_K * bounceY * dt;
  bounceV *= Math.exp(-P.BOUNCE_D * dt);
  bounceY += bounceV * dt;

  beatPhase += dt * 0.05;
  beatPhaseSmooth += (beatPhase - beatPhaseSmooth) * Math.min(1, dt * 1.6);

  const centroidNow = computeCentroid(freq);
  centroidSmooth += (centroidNow - centroidSmooth) * Math.min(1, dt * 1.2);

  // update spectrum + flux
  spectrum.update(freq);
  const fluxValue = fluxTracker.next(spectrum.bytes);

  // feature bus
  const fullnessRaw = Math.cbrt(Math.max(0, bassN * midN * hiN));
  updateChan(feat.volume, volN, dt);
  updateChan(feat.fullness, fullnessRaw, dt);
  updateChan(feat.centroid, centroidSmooth, dt);
  updateChan(feat.onsetDensity, onsetDensityNow(), dt);
  updateChan(feat.flux, fluxValue, dt);

  // tension (drive gated by liveness so noise can't accumulate)
  const tensionDrive =
    (Math.max(0, feat.volume.dev) * 1.0 +
      Math.max(0, feat.fullness.dev) * 1.2 +
      Math.max(0, feat.flux.dev) * 1.5 +
      Math.max(0, feat.onsetDensity.dev) * 0.6) *
    liveness;
  tension +=
    (tensionDrive * P.TENSION_GAIN - tension * P.TENSION_DECAY) * dt;
  tension = clamp(tension, 0, P.TENSION_MAX);

  // whiteout — four-way AND-gated, modulated by tension
  const volExc = smoothstep01(
    P.WHITEOUT_VOL_GATE[0],
    P.WHITEOUT_VOL_GATE[1],
    feat.volume.dev,
  );
  const fullExc = smoothstep01(
    P.WHITEOUT_FULL_GATE[0],
    P.WHITEOUT_FULL_GATE[1],
    feat.fullness.dev,
  );
  const loudEnough = smoothstep01(
    P.WHITEOUT_LOUD_GATE[0],
    P.WHITEOUT_LOUD_GATE[1],
    feat.volume.short,
  );
  const tensionEnough = smoothstep01(
    P.WHITEOUT_TENSION_GATE[0],
    P.WHITEOUT_TENSION_GATE[1],
    tension,
  );
  const gateOpen = volExc * fullExc * loudEnough * tensionEnough;
  const whiteoutTarget = Math.min(P.WHITEOUT_MAX, gateOpen);
  const whiteoutRate =
    whiteoutTarget > uWhiteoutVal
      ? P.WHITEOUT_ATTACK_RATE
      : P.WHITEOUT_RELEASE_RATE;
  uWhiteoutVal +=
    (whiteoutTarget - uWhiteoutVal) * Math.min(1, dt * whiteoutRate);
  if (uWhiteoutVal > 0.2) {
    tension = Math.max(0, tension - uWhiteoutVal * dt * P.WHITEOUT_DRAIN_RATE);
  }
  // log whiteout fire (rising edge)
  if (uWhiteoutVal > 0.3 && !_whiteoutWasFiring) {
    _whiteoutWasFiring = true;
    console.log(
      "%c⚡ WHITEOUT",
      "color: #fff; background: #222; padding: 2px 8px; font-weight: bold; border-radius: 3px;",
      {
        target: +whiteoutTarget.toFixed(2),
        gates: {
          vol: +volExc.toFixed(2),
          full: +fullExc.toFixed(2),
          loud: +loudEnough.toFixed(2),
          tension: +tensionEnough.toFixed(2),
        },
        tension: +tension.toFixed(2),
        regime: REGIMES[regimeIdx].name,
      },
    );
  } else if (uWhiteoutVal < 0.05) {
    _whiteoutWasFiring = false;
  }

  // brightness / energy — crossfade source by liveness
  const brightnessSrc = absVolSmooth + (volN - absVolSmooth) * liveness;
  const sigT = smoothstep01(P.BRIGHT_SIG[0], P.BRIGHT_SIG[1], brightnessSrc);
  const brightnessTarget = P.BRIGHT_FLOOR + P.BRIGHT_RANGE * sigT;
  uBrightnessVal +=
    (brightnessTarget - uBrightnessVal) *
    Math.min(1, dt * P.BRIGHT_FOLLOW_RATE);

  const energyTarget =
    P.ENERGY_FLOOR +
    P.ENERGY_RANGE * sigT +
    P.ENERGY_TENSION_BOOST * Math.min(1, tension * 0.6);
  uEnergyVal +=
    (energyTarget - uEnergyVal) * Math.min(1, dt * P.BRIGHT_FOLLOW_RATE);
  uEnergyVal = Math.min(P.ENERGY_MAX, uEnergyVal);

  // beat presence
  const beatTarget = smoothstep01(
    P.BEAT_PRESENCE_RANGE[0],
    P.BEAT_PRESENCE_RANGE[1],
    feat.onsetDensity.short,
  );
  uBeatPresenceVal +=
    (beatTarget - uBeatPresenceVal) * Math.min(1, dt * P.BEAT_FOLLOW_RATE);

  slowPhase += dt * (0.05 + env.vol * 0.18);

  if (now - segmentDriftAt > P.SEGMENTS_DRIFT_MS) {
    segmentDriftAt = now;
    segments = 4 + Math.floor(Math.random() * 6);
  }

  // regime switching (boil model)
  const novInstant = noveltyNow(feat) * liveness;
  const drive = Math.max(0, novInstant - P.NOVELTY_BOIL);
  sustainedNovelty +=
    (drive * P.NOVELTY_HEAT_RATE -
      sustainedNovelty * P.NOVELTY_COOL_RATE) *
    dt;
  sustainedNovelty = clamp(sustainedNovelty, 0, P.NOVELTY_MAX);
  const nov = sustainedNovelty;
  if (
    nov > P.NOVELTY_THRESHOLD &&
    now - lastRegimeSwitchAt > P.REGIME_COOLDOWN_MS
  ) {
    const { idx, scores, heat } = pickNextRegime({
      feat,
      tension,
      currentIdx: regimeIdx,
    });
    switchRegime(idx, now, { scores, heat, novInstant });
    for (const k in feat) {
      const ch = feat[k as keyof typeof feat];
      ch.short = ch.long;
    }
    sustainedNovelty = 0;
  }

  // crossfade regime params
  crossfadeRegime(regimeCur, regimeTarget, dt);

  // switch flash decay
  switchFlash = Math.max(
    0,
    switchFlash - dt * P.SWITCH_FLASH_DECAY * Math.max(switchFlash, 0.3),
  );

  // palette crossfade
  if (palMix < 1) {
    palMix = Math.min(1, palMix + dt / P.PAL_SWAP_DURATION);
    if (palMix === 1) {
      palCurIdx = palNextIdx;
      palCur = flatPal(palCurIdx);
    }
  }

  // ---- HUD + dashboard ----
  updateHud({
    bass: env.bass,
    mid: env.mid,
    hi: env.hi,
    liveness,
    beatPresence: uBeatPresenceVal,
    tension,
    whiteout: uWhiteoutVal,
    novelty: nov,
  });
  pushDash({
    bass: env.bass,
    mid: env.mid,
    hi: env.hi,
    liveness,
    tension,
    novelty: nov,
    whiteout: uWhiteoutVal,
  });
  drawDash(now, lastRegimeSwitchAt);

  // ---- render ----
  // Band uniforms are pre-multiplied by liveness so the visualizer's
  // audio-driven terms go quiet in silence.
  const ctx: RenderContext = {
    width: canvas.width,
    height: canvas.height,
    time: t,
    dt,
    slowPhase,
    beatPhase: beatPhaseSmooth,
    bass: env.bass * liveness,
    mid: env.mid * liveness,
    hi: env.hi * liveness,
    bassRaw: raw.bass * liveness,
    midRaw: raw.mid * liveness,
    hiRaw: raw.hi * liveness,
    onBass: onset.bass,
    onMid: onset.mid,
    onHi: onset.hi,
    bounce: bounceY,
    centroid: centroidSmooth * liveness,
    brightness: uBrightnessVal,
    energy: uEnergyVal,
    whiteout: uWhiteoutVal,
    beatPresence: uBeatPresenceVal,
    switchFlash,
    liveness,
    segments,
    regime: regimeCur,
    paletteCur: palCur,
    paletteNext: palNext,
    paletteMix: palMix,
    colMap: colorMap.weights,
    colBase: colorMap.base,
    spectrumTexture: spectrum.tex,
  };
  visualizer.render(gl, vizState, ctx);

  requestAnimationFrame(frame);
}

// ---- start ----
async function go(): Promise<void> {
  hideWelcomeCard();
  await startAudio(handleOnset);
  requestAnimationFrame(frame);
}
onUserGesture(go);

// Keyboard shortcut: press "n" to force a uniformly-random regime switch.
// Bypasses the heuristic picker AND the cooldown — useful for quickly
// auditioning regimes or when you just want a change.
window.addEventListener("keydown", (e: KeyboardEvent) => {
  if ((e.key === "n" || e.key === "N") && !e.metaKey && !e.ctrlKey && !e.altKey) {
    manualSwitchRegime();
  }
});

// On reload, if mic permission is already granted, jump straight back in.
(async () => {
  if (!navigator.permissions || !navigator.permissions.query) return;
  let perm: PermissionStatus;
  try {
    perm = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
  } catch {
    return; // some browsers reject the 'microphone' name
  }
  if (perm.state !== "granted") return;
  await go();
  const ctx = getAudioCtx();
  if (ctx && ctx.state !== "running") {
    const resumeOnce = () => ctx.resume();
    addEventListener("pointerdown", resumeOnce, { once: true });
    addEventListener("keydown", resumeOnce, { once: true });
  }
})();

logBoot();
