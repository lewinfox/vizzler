// Visualizer module interface.
//
// Each visualizer is a self-contained module that owns its own GL state
// (program, VBOs, textures) and renders one frame given a shared
// RenderContext (audio + macro state + regime + viewport).
//
// Audio computation, feature bus, regime selection, and palette logic all
// live OUTSIDE the visualizer. Visualizers only consume.
//
// To add a new visualizer:
//   1. Create src/visualizers/<name>/ with index.ts + shader files
//   2. Export `default { name, init, render }` matching this interface
//   3. Register it in src/visualizers/registry.ts (when there are >1)

import type { RegimeParams } from "../regimes/index.ts";

// Audio + macro snapshot the orchestrator builds each frame and hands to
// the active visualizer. Visualizers consume from this — they don't compute
// audio themselves.

export interface RenderContext {
  // viewport
  width: number;
  height: number;

  // time
  time: number; // seconds since start
  dt: number; // seconds since last frame
  slowPhase: number; // accumulated chaotic drift
  beatPhase: number; // smoothed bass-onset accumulator

  // smoothed (viscous) bands — pre-multiplied by liveness
  bass: number;
  mid: number;
  hi: number;
  // raw bands — pre-multiplied by liveness
  bassRaw: number;
  midRaw: number;
  hiRaw: number;
  // onset envelopes (gated at the source)
  onBass: number;
  onMid: number;
  onHi: number;
  // bouncy bass spring
  bounce: number;
  // smoothed centroid — pre-multiplied by liveness
  centroid: number;

  // derived macro state
  brightness: number;
  energy: number;
  whiteout: number;
  beatPresence: number;
  switchFlash: number;
  liveness: number;

  // segment count (kaleidoscope-specific but included on the shared context;
  // visualizers that don't use it can ignore it)
  segments: number;

  // current crossfaded regime params
  regime: RegimeParams;

  // palette state — two palettes lerped by paletteMix
  paletteCur: Float32Array; // 12 floats: a/b/c/d as 3-tuples
  paletteNext: Float32Array;
  paletteMix: number;
  colMap: { x: number; y: number; z: number; w: number };
  colBase: number;

  // shared spectrum texture (already updated for the frame)
  spectrumTexture: WebGLTexture;
}

export interface Visualizer<State = unknown> {
  /** Unique identifier — referenced from Regime.visualizer */
  name: string;
  /** One-time setup; returns opaque per-visualizer state. */
  init(gl: WebGL2RenderingContext): State;
  /** Render one frame using the supplied context. */
  render(gl: WebGL2RenderingContext, state: State, ctx: RenderContext): void;
  /** Optional cleanup when this visualizer is being swapped out for another. */
  dispose?(gl: WebGL2RenderingContext, state: State): void;
}
