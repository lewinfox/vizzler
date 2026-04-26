// Spectral centroid — log-weighted "where in the spectrum the energy lives."
// Returns a value in 0..1.

export function computeCentroid(
  freq: Uint8Array<ArrayBufferLike> | null,
): number {
  if (!freq) return 0.5;
  let num = 0;
  let denom = 0;
  const N = freq.length;
  const invLogN = 1 / Math.log2(N);
  for (let i = 2; i < N; i++) {
    const v = freq[i];
    num += v * Math.log2(i + 1) * invLogN;
    denom += v;
  }
  return denom > 1 ? num / denom : 0.5;
}
