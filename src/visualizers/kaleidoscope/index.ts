// Kaleidoscope visualizer — the original full-screen fragment shader.
// Conforms to the shared Visualizer interface so other visualizers can
// be added alongside it later.

import vsSource from "./shader.vert?raw";
import fsSource from "./shader.frag?raw";
import type { RenderContext, Visualizer } from "../types.ts";

interface KState {
  prog: WebGLProgram;
  vbo: WebGLBuffer;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error("could not create shader");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    throw new Error("shader compile failed");
  }
  return s;
}

const UNIFORM_NAMES = [
  "uRes",
  "uTime",
  "uBass",
  "uMid",
  "uHi",
  "uBassRaw",
  "uMidRaw",
  "uHiRaw",
  "uOnBass",
  "uOnMid",
  "uOnHi",
  "uBounce",
  "uCentroid",
  "uBeat",
  "uSlow",
  "uSegments",
  "uPalA",
  "uPalB",
  "uPalMix",
  "uRegSegOff",
  "uRegTwist",
  "uRegWarp",
  "uRegRings",
  "uRegSparkle",
  "uRegRays",
  "uRegHue",
  "uSwitchFlash",
  "uBrightness",
  "uEnergy",
  "uWhiteout",
  "uBeatPresence",
  "uColMap",
  "uColBase",
  "uSpectrum",
] as const;

const kaleidoscope: Visualizer<KState> = {
  name: "kaleidoscope",

  init(gl) {
    const prog = gl.createProgram();
    if (!prog) throw new Error("could not create program");
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vsSource));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fsSource));
    gl.bindAttribLocation(prog, 0, "a");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) ?? "program link failed");
    }
    gl.useProgram(prog);

    // Single full-screen triangle (oversized so it covers the viewport).
    const vbo = gl.createBuffer();
    if (!vbo) throw new Error("could not create kaleidoscope VBO");
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );

    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const name of UNIFORM_NAMES) {
      uniforms[name] = gl.getUniformLocation(prog, name);
    }
    gl.uniform1i(uniforms.uSpectrum, 0);

    return { prog, vbo, uniforms };
  },

  render(gl, state, ctx: RenderContext) {
    const { uniforms: U } = state;
    gl.useProgram(state.prog);
    // (re)bind our VBO each frame — other visualizers may have bound their own.
    gl.bindBuffer(gl.ARRAY_BUFFER, state.vbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND);

    gl.uniform2f(U.uRes, ctx.width, ctx.height);
    gl.uniform1f(U.uTime, ctx.time);

    gl.uniform1f(U.uBass, ctx.bass);
    gl.uniform1f(U.uMid, ctx.mid);
    gl.uniform1f(U.uHi, ctx.hi);
    gl.uniform1f(U.uBassRaw, ctx.bassRaw);
    gl.uniform1f(U.uMidRaw, ctx.midRaw);
    gl.uniform1f(U.uHiRaw, ctx.hiRaw);
    gl.uniform1f(U.uOnBass, ctx.onBass);
    gl.uniform1f(U.uOnMid, ctx.onMid);
    gl.uniform1f(U.uOnHi, ctx.onHi);
    gl.uniform1f(U.uBounce, ctx.bounce);
    gl.uniform1f(U.uCentroid, ctx.centroid);
    gl.uniform1f(U.uBeat, ctx.beatPhase);
    gl.uniform1f(U.uSlow, ctx.slowPhase);
    gl.uniform1f(U.uSegments, ctx.segments);

    gl.uniform3fv(U.uPalA, ctx.paletteCur);
    gl.uniform3fv(U.uPalB, ctx.paletteNext);
    gl.uniform1f(U.uPalMix, ctx.paletteMix);
    gl.uniform4f(
      U.uColMap,
      ctx.colMap.x,
      ctx.colMap.y,
      ctx.colMap.z,
      ctx.colMap.w,
    );
    gl.uniform1f(U.uColBase, ctx.colBase);

    gl.uniform1f(U.uRegSegOff, ctx.regime.segOff ?? 0);
    gl.uniform1f(U.uRegTwist, ctx.regime.twist ?? 1.0);
    gl.uniform1f(U.uRegWarp, ctx.regime.warp ?? 1.0);
    gl.uniform1f(U.uRegRings, ctx.regime.rings ?? 1.0);
    gl.uniform1f(U.uRegSparkle, ctx.regime.sparkle ?? 1.0);
    gl.uniform1f(U.uRegRays, ctx.regime.rays ?? 1.0);
    gl.uniform1f(U.uRegHue, ctx.regime.hue ?? 0);

    gl.uniform1f(U.uSwitchFlash, ctx.switchFlash);
    gl.uniform1f(U.uBrightness, ctx.brightness);
    gl.uniform1f(U.uEnergy, ctx.energy);
    gl.uniform1f(U.uWhiteout, ctx.whiteout);
    gl.uniform1f(U.uBeatPresence, ctx.beatPresence);

    // Spectrum texture is bound to TEXTURE0 by the shared spectrum module
    // each frame; we just reference the unit here.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, ctx.spectrumTexture);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  },

  dispose(gl, state) {
    gl.deleteProgram(state.prog);
    gl.deleteBuffer(state.vbo);
  },
};

export default kaleidoscope;
