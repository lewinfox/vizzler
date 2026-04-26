// Spectrum texture: log-bucketed 1-row R8 texture, auto-gained globally so
// the rays look balanced regardless of song level. Updated each frame from
// the AnalyserNode's freq bytes.

import { SPEC_N } from "../params.ts";

export class SpectrumTexture {
  readonly bytes = new Uint8Array(SPEC_N);
  readonly tex: WebGLTexture;
  private specMax = 1;

  constructor(private gl: WebGL2RenderingContext) {
    const tex = gl.createTexture();
    if (!tex) throw new Error("could not create spectrum texture");
    this.tex = tex;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      SPEC_N,
      1,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      new Uint8Array(SPEC_N),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  // Refill bytes from the freq array (or zero out) and upload to GPU.
  // Use ArrayBufferLike so we accept the freq buffer from getByteFrequencyData
  // (whose generic type is wider than the default Uint8Array<ArrayBuffer>).
  update(freq: Uint8Array<ArrayBufferLike> | null): void {
    const { bytes } = this;
    if (!freq) {
      bytes.fill(0);
    } else {
      const N = freq.length;
      let frameMax = 0;
      for (let i = 0; i < SPEC_N; i++) {
        const t0 = i / SPEC_N;
        const t1 = (i + 1) / SPEC_N;
        const a = Math.floor(2 + Math.pow(t0, 1.7) * (N - 4));
        const b = Math.max(a + 1, Math.floor(2 + Math.pow(t1, 1.7) * (N - 4)));
        let m = 0;
        for (let j = a; j < b; j++) if (freq[j] > m) m = freq[j];
        bytes[i] = m;
        if (m > frameMax) frameMax = m;
      }
      this.specMax = Math.max(this.specMax * 0.995, frameMax, 32);
      const scale = 255 / this.specMax;
      for (let i = 0; i < SPEC_N; i++) {
        const v = bytes[i] * scale;
        bytes[i] = v > 255 ? 255 : v | 0;
      }
    }
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      SPEC_N,
      1,
      gl.RED,
      gl.UNSIGNED_BYTE,
      bytes,
    );
  }
}

// Spectral flux: sum of positive bin changes per call. Used by the feature
// bus as a "spectrum is moving" signal independent of overall volume.
export class SpectralFlux {
  private prev = new Uint8Array(SPEC_N);
  next(currentBytes: Uint8Array): number {
    let f = 0;
    for (let i = 0; i < SPEC_N; i++) {
      const d = currentBytes[i] - this.prev[i];
      if (d > 0) f += d;
      this.prev[i] = currentBytes[i];
    }
    return f / (255 * SPEC_N);
  }
}
