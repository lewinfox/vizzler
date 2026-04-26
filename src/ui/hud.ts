// HUD text readout — bottom-left line of small text reflecting key metrics.

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`HUD element #${id} not found`);
  return e;
}

const els = {
  bv: el("bv"),
  mv: el("mv"),
  hv: el("hv"),
  liv: el("liv"),
  bts: el("bts"),
  tns: el("tns"),
  whi: el("whi"),
  nv: el("nv"),
  rg: el("rg"),
};

export interface HudValues {
  bass: number;
  mid: number;
  hi: number;
  liveness: number;
  beatPresence: number;
  tension: number;
  whiteout: number;
  novelty: number;
}

export function updateHud(v: HudValues): void {
  els.bv.textContent = v.bass.toFixed(2);
  els.mv.textContent = v.mid.toFixed(2);
  els.hv.textContent = v.hi.toFixed(2);
  els.liv.textContent = v.liveness.toFixed(2);
  els.bts.textContent = v.beatPresence.toFixed(2);
  els.tns.textContent = v.tension.toFixed(2);
  els.whi.textContent = v.whiteout.toFixed(2);
  els.nv.textContent = v.novelty.toFixed(2);
}

export function setRegimeLabel(name: string): void {
  els.rg.textContent = name;
}
