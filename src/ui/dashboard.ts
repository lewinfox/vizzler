// Wireframe diagnostic strip just above the HUD: three mini line plots
// of bass/mid/hi, liveness/tension, novelty/whiteout, plus a regime
// closeness bar (cooldown progress × novelty ratio).

import {
  NOVELTY_THRESHOLD,
  REGIME_COOLDOWN_MS,
  TENSION_MAX,
} from "../params.ts";

const HIST_LEN = 240; // ~4s at 60fps
const DASH_W = 360;
const DASH_H = 84;

interface History {
  bass: Float32Array;
  mid: Float32Array;
  hi: Float32Array;
  liveness: Float32Array;
  tension: Float32Array;
  novelty: Float32Array;
  whiteout: Float32Array;
}

const hist: History = {
  bass: new Float32Array(HIST_LEN),
  mid: new Float32Array(HIST_LEN),
  hi: new Float32Array(HIST_LEN),
  liveness: new Float32Array(HIST_LEN),
  tension: new Float32Array(HIST_LEN),
  novelty: new Float32Array(HIST_LEN),
  whiteout: new Float32Array(HIST_LEN),
};
let histPtr = 0;

const dashCanvas = document.getElementById("dash") as HTMLCanvasElement;
const dx = dashCanvas.getContext("2d");
if (!dx) throw new Error("could not get 2d context for dashboard");
dx.scale(2, 2); // 2× backing store for crisp lines on retina

export interface DashSnapshot {
  bass: number;
  mid: number;
  hi: number;
  liveness: number;
  tension: number;
  novelty: number;
  whiteout: number;
  lastRegimeSwitchAt: number;
}

export function pushDash(snapshot: Omit<DashSnapshot, "lastRegimeSwitchAt">): void {
  histPtr = (histPtr + 1) % HIST_LEN;
  hist.bass[histPtr] = snapshot.bass;
  hist.mid[histPtr] = snapshot.mid;
  hist.hi[histPtr] = snapshot.hi;
  hist.liveness[histPtr] = snapshot.liveness;
  hist.tension[histPtr] = snapshot.tension;
  hist.novelty[histPtr] = snapshot.novelty;
  hist.whiteout[histPtr] = snapshot.whiteout;
}

interface SeriesSpec {
  buf: Float32Array;
  label: string;
  color: string;
  min: number;
  max: number;
}

function drawLine(
  buf: Float32Array,
  x: number,
  y: number,
  w: number,
  h: number,
  vMin: number,
  vMax: number,
  color: string,
): void {
  dx!.strokeStyle = color;
  dx!.lineWidth = 1;
  dx!.beginPath();
  const range = vMax - vMin || 1;
  for (let i = 0; i < HIST_LEN; i++) {
    const idx = (histPtr + 1 + i) % HIST_LEN;
    const t = (buf[idx] - vMin) / range;
    const px = x + (i / (HIST_LEN - 1)) * w;
    const py = y + h - Math.max(0, Math.min(1, t)) * h;
    if (i === 0) dx!.moveTo(px, py);
    else dx!.lineTo(px, py);
  }
  dx!.stroke();
}

function drawPanel(
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  lines: SeriesSpec[],
): void {
  const ctx = dx!;
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.5);
  ctx.lineTo(x + w, y + h * 0.5);
  ctx.stroke();
  for (const l of lines) drawLine(l.buf, x, y, w, h, l.min, l.max, l.color);
  ctx.font = "8px ui-monospace, Menlo, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText(title, x + 3, y + 9);
  let lx = x + w - 3;
  for (let i = lines.length - 1; i >= 0; i--) {
    const txt = lines[i].label;
    ctx.fillStyle = lines[i].color;
    const tw = ctx.measureText(txt).width;
    ctx.fillText(txt, lx - tw, y + 9);
    lx -= tw + 6;
  }
}

export function drawDash(now: number, lastRegimeSwitchAt: number): void {
  const ctx = dx!;
  ctx.clearRect(0, 0, DASH_W, DASH_H);
  const PAD = 4;
  const GAP = 6;
  const panelW = (DASH_W - PAD * 2 - GAP * 2) / 3;
  const panelH = 44;
  const panelY = PAD;

  drawPanel(PAD, panelY, panelW, panelH, "bands", [
    { buf: hist.bass, label: "bass", color: "#ff63c8", min: 0, max: 1 },
    { buf: hist.mid, label: "mid", color: "#ffd166", min: 0, max: 1 },
    { buf: hist.hi, label: "hi", color: "#6cf", min: 0, max: 1 },
  ]);
  drawPanel(PAD + panelW + GAP, panelY, panelW, panelH, "state", [
    { buf: hist.liveness, label: "live", color: "#6f6", min: 0, max: 1 },
    { buf: hist.tension, label: "tens", color: "#fff", min: 0, max: TENSION_MAX },
  ]);
  drawPanel(PAD + (panelW + GAP) * 2, panelY, panelW, panelH, "triggers", [
    {
      buf: hist.novelty,
      label: "nov",
      color: "#ffd166",
      min: 0,
      max: NOVELTY_THRESHOLD * 2,
    },
    { buf: hist.whiteout, label: "whi", color: "#fff", min: 0, max: 1 },
  ]);

  // Regime closeness bar — cooldownProgress × noveltyRatio, hits 100% when
  // a regime switch is allowed. Pink tick on the bar shows where cooldown
  // alone places the limit, so you can see if cooldown is the bottleneck.
  const cooldownProg = Math.min(
    1,
    (now - lastRegimeSwitchAt) / REGIME_COOLDOWN_MS,
  );
  const novRatio = Math.min(1, hist.novelty[histPtr] / NOVELTY_THRESHOLD);
  const closeness = cooldownProg * novRatio;

  const barX = PAD + 56;
  const barY = panelY + panelH + 8;
  const barW = DASH_W - barX - PAD - 32;
  const barH = 10;
  ctx.font = "9px ui-monospace, Menlo, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText("regime →", PAD, barY + 8);
  ctx.strokeStyle = "rgba(255,255,255,0.20)";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(barX + 0.5, barY + 0.5, barW, barH);
  const fillW = Math.max(0, barW - 2) * closeness;
  ctx.fillStyle =
    closeness > 0.95
      ? "#ffd166"
      : closeness > 0.6
        ? "rgba(255,209,102,0.6)"
        : "rgba(108, 204, 255, 0.5)";
  ctx.fillRect(barX + 1, barY + 1, fillW, barH - 2);
  if (cooldownProg < 1) {
    ctx.strokeStyle = "rgba(255,90,200,0.6)";
    ctx.beginPath();
    ctx.moveTo(barX + barW * cooldownProg, barY - 1);
    ctx.lineTo(barX + barW * cooldownProg, barY + barH + 1);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  const pctText = Math.round(closeness * 100) + "%";
  ctx.fillText(pctText, barX + barW + 5, barY + 8);
}
