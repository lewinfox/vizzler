// AnalyserNode + AudioWorklet setup. Owns the WebAudio context and the FFT
// buffer that other modules read from. The worklet posts onset events into
// a callback supplied at start time.

import { GAIN_DECAY } from "../params.ts";
import { WORKLET_CODE } from "./worklet.ts";

export interface OnsetEvent {
  band: "bass" | "mid" | "hi";
  strength: number;
}

let analyser: AnalyserNode | null = null;
let freq: Uint8Array<ArrayBuffer> | null = null;
let audioCtx: AudioContext | null = null;
let onsetNode: AudioWorkletNode | null = null;
let onsetSink: GainNode | null = null;

export function getAudioCtx(): AudioContext | null {
  return audioCtx;
}
export function getFreq(): Uint8Array<ArrayBuffer> | null {
  return freq;
}
export function getAnalyser(): AnalyserNode | null {
  return analyser;
}

// Average a slice of the freq array, normalize 0..1.
export function band(lo: number, hi: number): number {
  if (!freq) return 0;
  let s = 0;
  let n = 0;
  const a = Math.max(0, lo | 0);
  const b = Math.min(freq.length, hi | 0);
  for (let i = a; i < b; i++) {
    s += freq[i];
    n++;
  }
  return n > 0 ? s / n / 255 : 0;
}

// Per-band auto-gain. Keeps a running max per band; divides incoming value
// by that max so quiet songs still feel reactive. Floor of 0.04 prevents
// divide-by-zero.
const gain: Record<string, number> = { bass: 0.05, mid: 0.05, hi: 0.05 };
export function autoGain(name: string, value: number): number {
  gain[name] = Math.max(gain[name] * GAIN_DECAY, value, 0.04);
  return Math.min(1, value / gain[name]);
}

export async function startAudio(
  onOnset: (e: OnsetEvent) => void,
): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    audioCtx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    const src = audioCtx.createMediaStreamSource(stream);

    // AnalyserNode tightened for low latency: 10.7ms FFT window, no internal
    // smoothing (we apply our own per-signal in JS).
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0;
    src.connect(analyser);
    freq = new Uint8Array(analyser.frequencyBinCount);

    // AudioWorklet for onset detection. Falls back gracefully on failure.
    try {
      const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      await audioCtx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      onsetNode = new AudioWorkletNode(audioCtx, "onset-processor");
      // Silent gain keeps the node alive in the audio graph.
      onsetSink = audioCtx.createGain();
      onsetSink.gain.value = 0;
      src.connect(onsetNode);
      onsetNode.connect(onsetSink).connect(audioCtx.destination);
      onsetNode.port.onmessage = (e: MessageEvent<OnsetEvent>) => {
        onOnset(e.data);
      };
    } catch (werr) {
      console.warn(
        "AudioWorklet unavailable; onsets disabled (visuals still react to bands):",
        werr,
      );
    }
  } catch (err) {
    console.warn("mic denied/unavailable, running silent:", err);
  }
}
