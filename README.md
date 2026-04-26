# swirly · disco

A mic-reactive WebGL viz. Kaleidoscopic, gloopy, with a little Studio 54.
Designed for dark rooms and actual parties.

```
mic → bands + onsets → liveness gate → feature bus → tension
                                                       ↓
                                       brightness · energy · whiteout · beat
                                                       ↓
                                                  visualizer
                                                  (kaleidoscope | particles | …)
```

Built with **Vite** + **TypeScript**. Modular source, single-file output.

---

## Quick start

You need [Bun](https://bun.sh) for the package manager / runtime, and the project itself uses [Vite](https://vitejs.dev) for the dev server and bundler.

```bash
bun install
bun run dev         # Vite dev server at localhost:8000
```

Open <http://localhost:8000> and click the welcome card to grant mic.

After the first time, mic permission is sticky — saves trigger Vite's auto-reload, the page comes back up, and the auto-restart logic skips the welcome card. If audio feels dead after a reload, click anywhere in the window to resume the AudioContext (browser autoplay policy).

To produce a single shareable HTML file:

```bash
bun run build       # → dist/index.html (one self-contained file, ~41 KB)
bun run preview     # serve the built file at localhost:4173 to verify
```

The output is a self-contained HTML you can email, host on GitHub Pages, drop on a USB stick. Everything (JS, CSS, shaders) is inlined via [`vite-plugin-singlefile`](https://github.com/richardtallent/vite-plugin-singlefile).

---

## Project layout

```
viz/
├── package.json
├── tsconfig.json
├── vite.config.ts                     # dev server + single-file bundle config
├── README.md
├── src/
│   ├── index.html                     # entry, references main.ts + styles.css
│   ├── styles.css
│   ├── main.ts                        # orchestrator: frame loop, wiring
│   ├── params.ts                      # ALL TWEAKABLE PARAMETERS
│   ├── util.ts                        # smoothstep01, follow, clamp
│   ├── boot-log.ts                    # console diagnostics (boot banner)
│   ├── shader-types.d.ts              # `*.frag?raw` / `*.vert?raw` declarations
│   ├── audio/
│   │   ├── analyser.ts                # AnalyserNode + worklet setup
│   │   ├── worklet.ts                 # AudioWorkletProcessor source string
│   │   ├── feature-bus.ts             # multi-channel EMA + emphasis + noveltyNow
│   │   ├── centroid.ts                # spectral centroid
│   │   ├── spectrum.ts                # SpectrumTexture + SpectralFlux
│   │   └── onset-density.ts           # 3s ring buffer of onset timestamps
│   ├── regimes/
│   │   ├── index.ts                   # REGIMES array (heterogeneous, by visualizer)
│   │   ├── picker.ts                  # heuristic picker with thermo bias
│   │   └── crossfade.ts               # exp lerp + snap (cross-visualizer swap)
│   ├── palettes/
│   │   ├── index.ts                   # PALETTES + flatPal helper
│   │   └── color-map.ts               # randomized freq→hue weights
│   ├── visualizers/
│   │   ├── types.ts                   # Visualizer interface + RenderContext
│   │   ├── registry.ts                # all visualizers, indexed by name
│   │   ├── kaleidoscope/              # default visualizer
│   │   │   ├── index.ts
│   │   │   ├── shader.vert
│   │   │   └── shader.frag
│   │   └── particles/                 # GPU-fed CPU-simulated particle field
│   │       ├── index.ts
│   │       ├── params.ts
│   │       ├── curl.ts                # curl-noise force field
│   │       ├── particles.vert
│   │       ├── particles.frag         # soft-disc point sprite
│   │       ├── screen.vert            # full-screen triangle
│   │       ├── fade.frag              # ping-pong feedback fade
│   │       └── present.frag           # final composite to screen
│   └── ui/
│       ├── hud.ts                     # text HUD elements
│       ├── dashboard.ts               # wireframe diagnostic strip
│       └── welcome.ts                 # start card + user gesture
├── dist/                              # built output (gitignored)
└── legacy/
    └── index.html                     # the old monolithic single-file version
```

---

## The HUD

Bottom-left, low-opacity. Above it sits a wireframe diagnostic strip:

- **bands** — bass/mid/hi over the last ~4s
- **state** — liveness/tension over the last ~4s
- **triggers** — sustained novelty (gold) and whiteout (white)
- **regime →** closeness bar (cooldown progress × novelty ratio); pink tick = cooldown bottleneck

Text line:

```
REGIME · live X.XX · bass X.XX mid X.XX hi X.XX · beat X.XX · tens X.XX · whi X.XX · nov X.XX
```

| Field | Meaning |
|---|---|
| **REGIME** | Currently-active regime name (random on boot — drives both viz choice and params). |
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

### Visualizers

Two are built in:

- **kaleidoscope** — full-screen fragment shader: kaleidoscope fold + vortex twist + Lissajous-drifted domain-warped fbm + concentric rings + sunburst rays from the FFT + disco-ball twinkles + sigmoid tonemap. Reactive to every audio signal.
- **particles** — CPU-simulated particles in a curl-noise force field, drawn additively into a ping-pong feedback framebuffer. Trails come from fading the previous frame each tick. Audio mappings: centroid drives the noise spatial scale (low = big swoopy flows, high = small jittery turbulence), energy → speed, bass → cluster pull, bass-onsets → radial outward kicks.

When a regime switch crosses visualizers, the old visualizer's `dispose()` runs to free GL resources and the new one inits. Within-visualizer switches crossfade params; across-visualizer switches snap.

### Color

Spatial fbm noise dominates the kaleidoscope's palette index `ci` so the field always has texture. Audio terms add a smaller *rotation* — randomized weights per regime so each section has its own color identity. The particles visualizer uses the same palette pair, indexed by per-particle velocity magnitude.

### Brightness

Sigmoid of `mix(absVolSmooth, volN, liveness)`. Silent room collapses to brightness floor (~0.12); music sigmoids on the auto-gained value so quiet songs still light up. Tonemap (`1 - exp(-col · 0.95)`) compresses additive overlays smoothly toward 1.

---

## Adding a new visualizer

The interface is intentionally small. To add one:

1. Create `src/visualizers/<name>/`:
   ```
   src/visualizers/myviz/
   ├── index.ts            # default-export a Visualizer<State>
   ├── shader.vert         # if you want WebGL shaders
   └── shader.frag
   ```

2. Module shape (see `src/visualizers/types.ts`):

   ```ts
   import vsSource from "./shader.vert?raw";
   import fsSource from "./shader.frag?raw";
   import type { Visualizer } from "../types.ts";

   const myviz: Visualizer<State> = {
     name: "myviz",
     init(gl)  { /* compile, allocate GL state, return it */ },
     render(gl, state, ctx) { /* upload uniforms, draw */ },
     dispose(gl, state) { /* free GL resources on swap */ },
   };
   export default myviz;
   ```

3. Register it in `src/visualizers/registry.ts`:

   ```ts
   import myviz from "./myviz/index.ts";
   export const VISUALIZERS = { kaleidoscope, particles, myviz };
   ```

4. Add one or more regimes targeting it in `src/regimes/index.ts`:

   ```ts
   {
     name: "MY REGIME",
     visualizer: "myviz",
     p: { /* whatever keys your visualizer reads from ctx.regime */ },
     palettes: [/* indices into PALETTES */],
   }
   ```

Audio uniforms (`bass`, `mid`, `hi`, `centroid`, `bounce`, `onBass`, etc.) and macro state (`brightness`, `energy`, `whiteout`, `beatPresence`) all arrive on the `RenderContext` — you don't compute them, just consume.

The `?raw` suffix on shader imports tells Vite to inline the file's text as the default export. The `shader-types.d.ts` declarations make TypeScript happy.

### Adding a new regime

In `src/regimes/index.ts`, append to the `REGIMES` array. Set `visualizer` to whichever one this regime targets; pick keys for `p` that match what that visualizer reads (each visualizer supplies its own defaults if a key is missing).

### Adding a new palette

In `src/palettes/index.ts`, append to `PALETTES` — four 3-tuples (`[a, b, c, d]`) for the IQ cosine palette `a + b · cos(2π · (c · t + d))`. Then reference its index from one or more regimes' `palettes` array.

---

## Tuning guide

All knobs are in **`src/params.ts`** with comments and sane ranges. Save → Vite reloads the page → you see the change.

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

Per-visualizer constants (e.g., particle count, audio→swirl mapping) live in their visualizer's own `params.ts` next to the implementation.

Open the browser console for diagnostic logs:

- Boot banner: every param, regime, palette
- Per-regime-switch log with score table
- `↻ visualizer:` line whenever a switch crosses visualizer types
- Per-whiteout log with gate values
- `♪ room is LIVE` / `· room went silent` transitions

---

## Dev-loop notes

Vite's behavior on save:

- **Source TS / shader files** → full page reload (Vite's default for modules without explicit HMR accept handlers). Audio context suspends; click anywhere in the window to resume.
- **CSS** → instant hot replace, no reload. Audio context unaffected.

If you find yourself re-clicking constantly while iterating on shader values, you can add per-visualizer HMR accept handlers (Vite's `import.meta.hot.accept(...)`) so the visualizer recompiles its shaders in place without losing audio. Not implemented yet — easy to add later.

---

## Browser requirements

- **WebGL2** (sized texture format `R8`, framebuffers for the particle visualizer)
- **Web Audio API** with `AudioWorklet` (graceful fallback: visuals work, no per-onset reactivity)
- **Permissions API** for microphone (graceful fallback: shows welcome card)
- **`getUserMedia`** — requires a secure context. `localhost`/`127.0.0.1` and HTTPS work; raw `file://` doesn't (this is what the CORS error you saw was about).

Tested on recent Chromium and Firefox.

---

## Gotchas

- **Audio context starts suspended** after page load even with mic permission granted (autoplay policy). Visuals run, but they look dim and dead because no audio data flows. Click anywhere in the window to resume — the auto-resume listener handles it.
- **rAF throttling** for unfocused windows — visuals freeze when you switch windows. Bring the window to focus to unfreeze.
- **Don't open `src/index.html` directly** in the browser — module imports won't resolve from `file://`. Always go through `bun run dev`.
- **First few seconds of audio look quieter** — auto-gain's running max needs to track up.

---

## Legacy

The previous single-file version lives at `legacy/index.html` for reference. It works standalone (open in any browser via a localhost server), but isn't being developed against.
