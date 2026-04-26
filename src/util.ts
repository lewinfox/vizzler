// Small generic helpers used across modules.

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

// Hermite smoothstep interpolating x in [a, b] to [0, 1].
export function smoothstep01(a: number, b: number, x: number): number {
  if (b <= a) return x < a ? 0 : 1;
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Asymmetric attack/release follower. NOT dt-corrected — per-frame multiplier.
export function follow(
  prev: number,
  target: number,
  attack: number,
  release: number,
): number {
  const k = target > prev ? attack : release;
  return prev + (target - prev) * k;
}
