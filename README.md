# swirly · disco

A single-file mic-reactive WebGL visual. Kaleidoscopic, gloopy, with a little Studio 54.
Designed for dark rooms and actual parties.

```
mic → bands + onsets → liveness gate → feature bus → tension
                                                       ↓
                                       brightness · energy · whiteout · beat
                                                       ↓
                                        kaleidoscope · warp · rays · twinkles
```

Everything is in `index.html`. No build step, no dependencies.

---

## Quick start

You need to serve over `localhost` (browsers block `getUserMedia` and `audioWorklet.addModule` on `file://`).

```bash
cd /path/to/viz
python3 -m http.server 8000
```

Open <http://localhost:8000> and click the welcome card to grant mic.

After the first time, mic permission is sticky — reloads (or live-reload after a save) drop you straight back into the viz. If audio feels dead, click anywhere in the window to resume the AudioContext (browser autoplay policy).

Other servers that work fine:

```bash
npx serve -p 8000
php -S localhost:8000
ruby -run -e httpd . -p 8000
```

---

## The HUD

Bottom-left, low-opacity. Format:

```
REGIME · live X.XX · bass X.XX mid X.XX hi X.XX · beat X.XX · tens X.XX · whi X.XX · nov X.XX
```

| Field | Meaning |
|---|---|
| **REGIME** | Current regime name (DISCO FLOOR, MIRROR BALL, VORTEX, LAVA LAMP, AURORA). |
| **live** | Liveness gate, 0..1. ~0 in a silent room, ramps to 1 when music plays. |
| **bass / mid / hi** | Smoothed, auto-gained band energies (the values driving warp/heartbeat/etc.). |
| **beat** | Smoothed onset density, 0..1. Rises with a clear rhythm, falls with no beat. |
| **tens** | Tension — accumulated novelty across channels. Slowly charges, slowly decays. |
| **whi** | Current whiteout amount, 0..1. Should sit near 0 most of the time. |
| **nov** | Multi-channel novelty (gated by liveness). Triggers regime switch when it crosses `NOVELTY_THRESHOLD`. |

If `live` is 0 with music playing → mic isn't connected, audio context is suspended, or absolute volume is below `SILENCE_FLOOR`.
If `whi` keeps firing → tighten the `WHITEOUT_*_GATE` arrays.
If regimes never switch → lower `NOVELTY_THRESHOLD` or `F_LONG_RATE`.
If regimes switch too often → raise `NOVELTY_THRESHOLD` or `REGIME_COOLDOWN_MS`.

---

## How it works

### Audio pipeline

Two parallel paths from the mic:

1. **AnalyserNode** — small FFT (`fftSize = 512`, ~10ms window) with `smoothingTimeConstant = 0` so we apply our own smoothing in JS where it can be tuned per-signal. Gives us:
   - 3 frequency bands (bass / mid / hi) — averaged, shape-boosted, auto-gained.
   - A 64-bucket spectrum texture (log-spaced, auto-gained) sent to the shader for sunburst rays.
   - Spectral centroid (where in the spectrum energy lives).

2. **AudioWorklet** — runs in the audio thread, processing every 128 samples (~2.7ms at 48kHz). Three IIR bandpass biquads (150 / 900 / 4500 Hz) compute per-block RMS and spectral flux. When flux crosses an adaptive threshold, posts an onset event to the main thread. Onsets land 10–15ms faster than they would via `requestAnimationFrame` polling.

### Liveness gate

Auto-gain has no concept of silence — it normalizes mic noise up to look like a real signal. So we track the *absolute* (pre-auto-gain) volume separately, smooth it asymmetrically (fast attack, slow release), and sigmoid it into a `liveness` value 0..1.

Liveness multiplies the entire reactive layer: band uniforms, onset events, tension drive, novelty. Result: a silent room shows a calm idle (slow drift, dim color), and music ramps the whole system in smoothly when it starts.

### Feature bus

Five channels, each tracking short EMA + long EMA + autoscaled deviation:

| Channel | What it measures |
|---|---|
| `volume` | Mean of auto-gained bands. Overall loudness. |
| `fullness` | Geometric mean of bands. High only when all three fire simultaneously (broadband content). |
| `centroid` | Where in the spectrum the energy lives, log-weighted. |
| `onsetDensity` | Onsets per second over the last 3s. |
| `flux` | Sum of positive bin changes per frame. "Spectrum is moving." |

`dev = (short - long) / max(absDev * 1.5, 0.04)`, clamped −1..+1. Tells you "this channel just changed character relative to its recent baseline."

### Tension (thermodynamic accumulator)

Sum of positive devs (gated by liveness) charges `tension`. A slow decay term cools it back to ground state. The system "heats up" during interesting passages and naturally relaxes when audio is steady.

Tension drives whiteout intensity (gated, then drained when firing) and biases the regime picker toward energetic regimes when high.

### Whiteout (4-way AND gate)

Whiteout fires only when **all four** of these clear simultaneously:

1. `volume.dev` very high (loud relative to ~20s mean)
2. `fullness.dev` very high (broadband relative to ~20s mean)
3. `volume.short` genuinely loud in absolute terms
4. `tension` well above the floor (sustained buildup)

Because `gateOpen` is the *product* of four smoothstep gates each clamped 0..1, the result is near zero unless every condition is well clear. When it fires, tension drains fast so we can't sustain whiteout or re-fire soon. Aim: 0–2 fires per song, only on real payoff moments.

### Regime switching

When multi-channel novelty crosses `NOVELTY_THRESHOLD` and the cooldown has passed:

1. Pick a new regime via heuristic scoring (with thermodynamic bias — chill regimes preferred when tension is low, hot regimes when high).
2. All seven regime coefficients (segments offset, twist, warp, rings, sparkle, rays, hue) crossfade exponentially over ~2.7s.
3. Trigger a palette swap to one of the new regime's preferred palettes (1.6s crossfade).
4. Re-randomize the freq→color mapping so the new regime "speaks" a different color language.
5. Brief switch flash (~0.7s) for a felt "BOOP" moment.

### Color

The palette index `ci` for each pixel is dominated by **spatial** terms (fbm noise + warp length) so the field always has texture. Audio terms add a smaller *rotation* around the palette wheel — randomized weights per regime so each section of the song has its own color identity.

Two layers of color identity per regime:
- **Which palette is active** — crossfaded on regime switch from a curated list of 6 IQ cosine palettes.
- **Where in that palette** the audio puts you — `colBase` + `colMap · (centroid, bass, mid, hi)`.

### Brightness

Sigmoid of `mix(absVolSmooth, volN, liveness)`:

- Silent room → input is absolute volume → sigmoid ~0 → brightness floor (~0.12). Calm idle.
- Music playing → input is auto-gained volume → sigmoid scales naturally → brightness up to ~0.78.
- Quiet music section → still gets the auto-gain path, so it lights up properly.

The shader runs a per-channel exponential tonemap (`1 - exp(-col * 0.95)`) so additive overlays compress smoothly toward 1 instead of clipping to white. Whiteout is the *only* path to full white, and it's gated.

---

## Tuning guide

All knobs are in **`index.html`** in the section marked `TWEAKABLE PARAMETERS` (top of the script block, ~lines 200–350). Each block has a short note on what it does and a sane range. Live reload picks up changes on save.

### "If you only tweak one thing"

| Goal | Knob | Direction |
|---|---|---|
| More reactive overall | `F_LONG_RATE` | Lower (0.05 = ~20s baseline → bigger devs). Don't push above 0.20 or devs vanish. |
| Calmer overall | `F_LONG_RATE` | Higher (0.15 = ~7s baseline → smaller devs). |
| Whiteouts more often | `WHITEOUT_VOL_GATE[0]`, `WHITEOUT_FULL_GATE[0]` | Lower (e.g., 0.55 / 0.50). |
| Whiteouts rarer | Same gates | Higher (e.g., 0.85 / 0.80). Or bump `WHITEOUT_TENSION_GATE[0]`. |
| Regimes change more | `NOVELTY_THRESHOLD` ↓ or `REGIME_COOLDOWN_MS` ↓ | |
| Regimes change less | `NOVELTY_THRESHOLD` ↑ or `REGIME_COOLDOWN_MS` ↑ | |
| Feel snappier | `ATTACK_*` ↑ and `RELEASE_*` ↑ | Less viscous. |
| Feel gloopier | `ATTACK_*` ↓ and `RELEASE_*` ↓ | More lava-lamp. |
| Bouncier bass kick | `BOUNCE_K` ↑ (faster oscillation) or `BOUNCE_D` ↓ (more wobbles) | |
| Brighter overall | `BRIGHT_FLOOR`, `BRIGHT_RANGE` ↑ | But beware of whiteout headroom. |
| Calmer in a silent room | `MUSIC_THRESHOLD` ↑ (e.g., 0.25) | Liveness ramps in later. |

### Adding a regime

In the `REGIMES` array (search for `"DISCO FLOOR"`), append:

```js
{
    name: "MOON ROOM",
    p: {
        segOff: 3,    // kaleidoscope segments offset (-2..+4 sane)
        twist: 0.6,   // vortex twist multiplier (0.3..2.5)
        warp: 0.8,    // domain-warp amount multiplier (0.5..2.0)
        rings: 0.4,   // concentric-ring strength (0..1.5)
        sparkle: 1.5, // disco-ball twinkle multiplier (0..3)
        rays: 1.0,    // sunburst ray multiplier (0..2)
        hue: 0.3,     // additional palette hue rotation (0..1)
    },
    palettes: [4, 1], // indices into PALETTES this regime prefers
},
```

If you want it to be biased toward chill or hot, edit `pickNextRegime()` (just below the `REGIMES` array) and add a name match.

### Adding a palette

In the `PALETTES` array, append four 3-element arrays representing the IQ cosine palette parameters `[a, b, c, d]` where each color is `a + b · cos(2π · (c · t + d))`:

```js
[
    [0.5, 0.5, 0.5],   // a — center color
    [0.5, 0.5, 0.5],   // b — color amplitude
    [1.0, 1.0, 1.0],   // c — color frequency per channel
    [0.0, 0.33, 0.67], // d — phase offset per channel (controls hue)
],
```

The d-vector is the most important — it controls the color rotation. `[0, 0.10, 0.20]` is a rainbow-ish sweep; `[0.5, 0.2, 0.25]` is a more limited warm range. Iñigo Quilez's [palette generator](https://iquilezles.org/articles/palettes/) is the canonical reference if you want to design new ones.

After adding the palette, reference its index in one or more regimes' `palettes` array so it actually gets picked.

### Things that aren't in the PARAMS section (but you can still tweak)

The shader (a template-literal string near the top of `index.html`) contains baseline values for things like:

- Pulse zoom formula (`0.88 + 0.30 * uEnergy + ...`)
- Vignette shape (`smoothstep(vigOuter, vigInner, rad)`)
- Noise scales in `fbm()`
- Tonemap exposure (`1 - exp(-col * 0.95)`)
- Vortex twist formula
- Lissajous drift on noise source

These are intentionally inline because they form coupled formulas — moving them to PARAMS would make the shader code less readable for a small win. If you want to change them, search the FS string for the relevant section.

---

## Browser requirements

- **WebGL2** — required for the shader (sized texture format `R8`).
- **Web Audio API** with `AudioWorklet` — required for low-latency onset detection. Falls back gracefully (visuals work, no onset reactivity) if the browser refuses to load the worklet.
- **Permissions API** for microphone — used for the auto-restart on reload. Falls back to showing the welcome card if the API isn't available (older Safari/Firefox).
- **`getUserMedia`** — requires a secure context. `localhost`/`127.0.0.1` and HTTPS work; raw `file://` doesn't.

Tested on recent Chromium and Firefox. Safari may need a recent version for the worklet path.

---

## Gotchas

- **Audio context starts suspended** after page load (autoplay policy), even with mic permission granted. Visuals run, but they look dim and dead because no audio data flows. Click anywhere in the window to resume — the auto-resume listener handles it.

- **rAF throttling** — some browsers throttle `requestAnimationFrame` when the window isn't focused. If the viz freezes when you switch windows, that's why. Bringing the window to focus unfreezes it.

- **Live-reload requires localhost** — the poller in the page polls `Last-Modified` on the current path. Only enabled when `location.hostname` is `localhost` or `127.0.0.1`. Safe to leave in for production (it no-ops elsewhere).

- **First few seconds of audio look quieter** than they should — auto-gain's running max needs to track up. Ramps in over ~5–10s.

---

## Layout

- `index.html` — everything. Single file. No dependencies.
- `README.md` — this file.

The script block in `index.html` is structured top to bottom as:

1. Architecture comment (signal flow)
2. **TWEAKABLE PARAMETERS** (~150 lines)
3. WebGL shader sources (VS, FS)
4. WebGL setup (compile, link, uniform locations, spectrum texture)
5. Audio setup (AnalyserNode, AudioWorklet via Blob URL)
6. Worklet message handler
7. Helpers (`band`, `follow`, `smoothstep01`, `autoGain`)
8. Module-level state (envelopes, onsets, spring, beat phase, etc.)
9. Feature bus (`makeChan`, `updateChan`, `noveltyNow`)
10. Tension / liveness state
11. Color mapping (palette index weights)
12. PALETTES and REGIMES
13. Regime picker / `switchRegime`
14. Spectrum / centroid utilities
15. HUD element refs
16. `frame()` loop
17. Welcome card / start logic / auto-restart on reload
