// AudioWorklet onset detector. Runs in the audio thread, processing every
// 128 samples (~2.7ms @ 48kHz). Three IIR bandpass biquads compute per-block
// RMS and spectral flux; an adaptive threshold fires onsets via postMessage.
//
// The worklet code lives as a string here because it's loaded into the
// browser's audio thread via a Blob URL — it can't be a TypeScript module
// (audio worklets aren't bundled by us, they're handed raw to the browser).

export const WORKLET_CODE = String.raw`
function makeBP(f0, Q, sr) {
  const w0 = 2 * Math.PI * f0 / sr;
  const alpha = Math.sin(w0) / (2 * Q);
  const a0 = 1 + alpha;
  return {
    b0: alpha / a0,
    b2: -alpha / a0,
    a1: -2 * Math.cos(w0) / a0,
    a2: (1 - alpha) / a0,
    x1: 0, x2: 0, y1: 0, y2: 0,
    step(x) {
      const y = this.b0*x + this.b2*this.x2 - this.a1*this.y1 - this.a2*this.y2;
      this.x2 = this.x1; this.x1 = x;
      this.y2 = this.y1; this.y1 = y;
      return y;
    }
  };
}

class OnsetProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    const sr = sampleRate;
    this.bp = {
      bass: makeBP(150, 1.0, sr),
      mid:  makeBP(900, 1.0, sr),
      hi:   makeBP(4500, 0.9, sr),
    };
    this.lastE = { bass: 0, mid: 0, hi: 0 };
    this.fluxAvg = { bass: 0.001, mid: 0.001, hi: 0.001 };
    this.energyAvg = { bass: 0.001, mid: 0.001, hi: 0.001 };
    this.refr = { bass: 0, mid: 0, hi: 0 };
    this.refrSamples = {
      bass: Math.floor(0.180 * sr),
      mid:  Math.floor(0.110 * sr),
      hi:   Math.floor(0.070 * sr),
    };
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;
    const ch = input[0];
    const N = ch.length;
    let sB = 0, sM = 0, sH = 0;
    const fb = this.bp.bass, fm = this.bp.mid, fh = this.bp.hi;
    for (let i = 0; i < N; i++) {
      const s = ch[i];
      const b = fb.step(s), m = fm.step(s), h = fh.step(s);
      sB += b*b; sM += m*m; sH += h*h;
    }
    const eB = Math.sqrt(sB / N);
    const eM = Math.sqrt(sM / N);
    const eH = Math.sqrt(sH / N);

    this.energyAvg.bass = this.energyAvg.bass * 0.92 + eB * 0.08;
    this.energyAvg.mid  = this.energyAvg.mid  * 0.92 + eM * 0.08;
    this.energyAvg.hi   = this.energyAvg.hi   * 0.92 + eH * 0.08;

    const flB = Math.max(0, eB - this.lastE.bass);
    const flM = Math.max(0, eM - this.lastE.mid);
    const flH = Math.max(0, eH - this.lastE.hi);
    this.lastE.bass = eB; this.lastE.mid = eM; this.lastE.hi = eH;

    this.fluxAvg.bass = this.fluxAvg.bass * 0.93 + flB * 0.07;
    this.fluxAvg.mid  = this.fluxAvg.mid  * 0.93 + flM * 0.07;
    this.fluxAvg.hi   = this.fluxAvg.hi   * 0.93 + flH * 0.07;

    if (this.refr.bass > 0) this.refr.bass -= N;
    if (this.refr.mid  > 0) this.refr.mid  -= N;
    if (this.refr.hi   > 0) this.refr.hi   -= N;

    const fire = (band, flux, energy) => {
      if (flux > this.fluxAvg[band] * 1.7 + 0.003
          && this.refr[band] <= 0
          && energy > Math.max(0.004, this.energyAvg[band] * 0.5)) {
        const strength = Math.min(1.0, flux / Math.max(this.fluxAvg[band] * 6, 0.03));
        this.port.postMessage({ band, strength });
        this.refr[band] = this.refrSamples[band];
      }
    };
    fire('bass', flB, eB);
    fire('mid',  flM, eM);
    fire('hi',   flH, eH);
    return true;
  }
}
registerProcessor('onset-processor', OnsetProcessor);
`;
