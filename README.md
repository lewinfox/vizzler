# swirly · disco

A mic-reactive WebGL viz. Kaleidoscopic, gloopy, with a little Studio 54.
Designed for dark rooms and actual parties.

```
mic → bands + onsets → liveness gate → feature bus → tension
                                                       ↓
                                       brightness · energy · whiteout · beat
                                                       ↓
                                                  visualizer
```

Built with **Bun** + **TypeScript**. Modular source, single-file output.

---

## Quick start

You need [Bun](https://bun.sh) installed.

```bash
bun install
bun dev          # dev server at localhost:8000 with watch + auto-reload
```

Open <http://localhost:8000> and click the welcome card to grant mic.

After the first time, mic permission is sticky — reloads (and the live-reload poller after a save) drop you straight back into the viz. If audio feels dead, click anywhere in the window to resume the AudioContext (browser autoplay policy).

To produce a single shareable HTML file:

```bash
bun run build    # → dist/index.html (one file, everything inlined)
```

The output is a self-contained ~30 KB HTML you can email, host on GitHub Pages, drop on a USB stick.

---

## Project layout

```
viz/
├── package.json
├── tsconfig.json
├── dev.ts                              # dev server (watch + serve)
├── build.ts                            # production build (bundle + inline)
├── README.md
├── src/
│   ├── index.html                      # entry, references main.ts + styles.css
│   ├── styles.css
│   ├── main.ts                         # orchestrator: frame loop, wiring
│   ├── params.ts                       # ALL TWEAKABLE PARAMETERS
│   ├── util.ts                         # smoothstep01, follow, clamp
│   ├── boot-log.ts                     # console diagnostics
│   ├── shader-types.d.ts               # text-import declarations for .frag/.vert
│   ├── audio/
│   │   ├── analyser.ts                 # AnalyserNode + worklet setup, band(), autoGain
│   │   ├── worklet.ts                  # AudioWorkletProcessor source string
│   │   ├── feature-bus.ts              # multi-channel EMA + emphasis + noveltyNow
│   │   ├── centroid.ts                 # spectral centroid
│   │   ├── spectrum.ts                 # SpectrumTexture + SpectralFlux
│   │   └── onset-density.ts            # 3s ring buffer of onset timestamps
│   ├── regimes/
│   │   ├── index.ts                    # REGIMES array + RegimeParams
│   │   ├── picker.ts                   # pickNextRegime (heuristic + thermo bias)
│   │   └── crossfade.ts                # exponential approach of regime params
│   ├── palettes/
│   │   ├── index.ts                    # PALETTES + flatPal helper
│   │   └── color-map.ts                # randomized freq→hue weights
│   ├── visualizers/
│   │   ├── types.ts                    # Visualizer interface + RenderContext
│   │   ├── registry.ts                 # all visualizers, indexed by name
│   │   └── kaleidoscope/
│   │       ├── index.ts                # default-export Visualizer<KState>
│   │       ├── shader.vert
│   │       └── shader.frag
│   └── ui/
│       ├── hud.ts                      # text HUD elements
│       ├── dashboard.ts                # wireframe diagnostic strip
│       ├── welcome.ts                  # start card + user gesture
│       └── live-reload.ts              # localhost-only Last-Modified poller
├── dist/                               # built output (gitignored)
└── legacy/
    └── index.html                      # the old monolithic single-file version
```

---

## The HUD

Bottom-left, low-opacity. Above it sits a wireframe diagnostic strip:

- **bands** — bass/mid/hi over the last ~4s
- **state** — liveness/tension over the last ~4s
- **triggers** — sustained novelty (gold) and whiteout (white)
- **regime →** closeness bar showing how close we are to the next switch (cooldown progress × novelty ratio); pink tick = cooldown bottleneck

Text line:

```
REGIME · live X.XX · bass X.XX mid X.XX hi X.XX · beat X.XX · tens X.XX · whi X.XX · nov X.XX
```

| Field | Meaning |
|---|---|
| **REGIME** | Currently-active regime name (random on boot). |
| **live** | Liveness gate, 0..1. ~0 in a silent room, ramps to 1 when music plays. |
| **bass / mid / hi** | Smoothed, auto-gained band energies. |
| **beat** | Smoothed onset density, 0..1. Rises with a clear rhythm. |
| **tens** | Tension — accumulated novelty across channels. |
| **whi** | Current whiteout amount (rare, 0..1). |
| **nov** | Sustained novelty. Crosses `NOVELTY_THRESHOLD` to trigger a switch. |

---

## How it works

### Audio pipeline

Two parallel paths from the mic:

1. **AnalyserNode** — small FFT (`fftSize = 512`, ~10ms window) with `smoothingTimeConstant = 0`. Gives 3 bands (bass / mid / hi), the spectrum texture for sunburst rays, and the spectral centroid.
2. **AudioWorklet** — runs in the audio thread, processing every 128 samples (~2.7ms @ 48kHz). Three IIR bandpass biquads + flux + adaptive threshold → onset events posted to the main thread within ~3ms.

### Liveness gate

Tracks the *absolute* (pre-auto-gain) volume separately and sigmoids it through `smoothstep(SILENCE_FLOOR, MUSIC_THRESHOLD, …)`. Multiplies the entire reactive layer (band uniforms, tension drive, novelty, onset events) so a silent room shows a calm idle.

### Feature bus

Five channels (`volume`, `fullness`, `centroid`, `onsetDensity`, `flux`), each tracking short EMA + long EMA + autoscaled deviation. The dev signal answers "what's this channel doing right now vs. its recent baseline."

### Tension

Charges from positive deviations across channels (gated by liveness), decays with a ~5s timeconstant when idle. Drives whiteout intensity and biases the regime picker. Whiteout firing drains it.

### Whiteout (4-way AND gate)

Only fires when **all four** clear simultaneously: `volume.dev` very high, `fullness.dev` very high, absolute volume genuinely loud, and tension well above floor. Aim: 0–2 fires per song.

### Regime switching (boil model)

`noveltyNow()` uses a per-channel emphasis function (returns 0 for `|dev| ≤ NOVELTY_FLOOR`) summed across channels. The aggregate goes into a "boil" integrator:

```
drive     = max(0, instantNovelty - NOVELTY_BOIL)
sustained += (drive·HEAT_RATE − sustained·COOL_RATE) · dt
```

Below `NOVELTY_BOIL` the integrator decays to zero and stays there. Above it, sustained climbs to a steady-state proportional to `drive`. Switch fires when `sustained > NOVELTY_THRESHOLD` and `REGIME_COOLDOWN_MS` has elapsed.

`pickNextRegime` scores all regimes by heuristic + thermodynamic bias (chill regimes preferred when tension is low, hot regimes when high) and picks the highest. Current regime is excluded so every switch is a real change.

### Color

Spatial fbm noise dominates the palette index `ci` so the field always has texture. Audio terms add a smaller *rotation* — randomized weights per regime so each section has its own color identity.

### Brightness

Sigmoid of `mix(absVolSmooth, volN, liveness)`. Silent room collapses to brightness floor (~0.12); music sigmoids on the auto-gained value so quiet songs still light up. Tonemap (`1 - exp(-col · 0.95)`) compresses additive overlays smoothly toward 1.

---

## Adding a new visualizer

1. Create `src/visualizers/<name>/`:
   ```
   src/visualizers/myviz/
   ├── index.ts        # default-export a Visualizer<State>
   ├── shader.vert
   └── shader.frag
   ```
2. The visualizer module shape (see `src/visualizers/types.ts`):
   ```ts
   import type { Visualizer } from "../types.ts";

   const myviz: Visualizer<State> = {
     name: "myviz",
     init(gl) { /* compile shaders, allocate state */ return state; },
     render(gl, state, ctx) { /* upload uniforms, draw */ },
   };
   export default myviz;
   ```
3. Register it in `src/visualizers/registry.ts`:
   ```ts
   import myviz from "./myviz/index.ts";
   export const VISUALIZERS = { kaleidoscope, myviz };
   ```
4. Audio uniforms (`bass`, `mid`, `hi`, `centroid`, `bounce`, `onBass`, etc.) and macro state (`brightness`, `energy`, `whiteout`, `beatPresence`) all arrive on the `RenderContext` — you don't compute them, just consume.

The shader files import as text via Bun's `with { type: "text" }`:

```ts
import vsSource from "./shader.vert" with { type: "text" };
import fsSource from "./shader.frag" with { type: "text" };
```

The bundler inlines them into the output, so no fetching at runtime.

### Adding a new regime

In `src/regimes/index.ts`, append to the `REGIMES` array. The current regime params are kaleidoscope-specific; once we have multiple visualizers, regimes will need a `visualizer` field too.

### Adding a new palette

In `src/palettes/index.ts`, append to `PALETTES` — four 3-tuples (`[a, b, c, d]`) for the IQ cosine palette `a + b · cos(2π · (c · t + d))`. Then reference its index from one or more regimes' `palettes` array.

---

## Tuning guide

All knobs are in **`src/params.ts`** with comments and sane ranges. Live reload picks up changes on save.

If you only tweak one thing, it's usually one of:

| Goal | Knob | Direction |
|---|---|---|
| More reactive overall | `F_LONG_RATE` | Lower (0.05 = ~20s baseline → bigger devs). |
| Whiteouts rarer | `WHITEOUT_VOL_GATE[0]`, `WHITEOUT_FULL_GATE[0]` | Higher. |
| Regimes change more | `NOVELTY_THRESHOLD` ↓ or `NOVELTY_BOIL` ↓ | |
| Regimes change less | `NOVELTY_THRESHOLD` ↑ or `REGIME_COOLDOWN_MS` ↑ | |
| Feel snappier | `ATTACK_*` ↑ and `RELEASE_*` ↑ | |
| Feel gloopier | `ATTACK_*` ↓ and `RELEASE_*` ↓ | |
| Brighter overall | `BRIGHT_FLOOR`, `BRIGHT_RANGE` ↑ | |
| Calmer in a silent room | `MUSIC_THRESHOLD` ↑ | Liveness ramps in later. |

Open the browser console for diagnostic logs:
- Boot banner: every param, regime, palette
- Per-regime-switch log with score table
- Per-whiteout log with gate values
- `♪ room is LIVE` / `· room went silent` transitions

---

## Browser requirements

- **WebGL2** (sized texture format `R8`)
- **Web Audio API** with `AudioWorklet` (graceful fallback: visuals work, no per-onset reactivity)
- **Permissions API** for microphone (graceful fallback: shows welcome card)
- **`getUserMedia`** — requires a secure context. `localhost`/`127.0.0.1` and HTTPS work; raw `file://` doesn't.

Tested on recent Chromium and Firefox.

---

## Gotchas

- **Audio context starts suspended** after page load even with mic permission granted (autoplay policy). Visuals run, but they look dim and dead because no audio data flows. Click anywhere in the window to resume — the auto-resume listener handles it.
- **rAF throttling** for unfocused windows — visuals freeze when you switch windows. Bring the window to focus to unfreeze.
- **Live-reload requires localhost** — the poller is gated to `localhost`/`127.0.0.1`. Safe to leave in production (no-ops elsewhere).
- **First few seconds of audio look quieter** — auto-gain's running max needs to track up.

---

## Legacy

The previous single-file version lives at `legacy/index.html` for reference. It works standalone (open in any browser via a localhost server), but isn't being developed against. Delete it whenever you're satisfied the new modular version is doing what you want.
