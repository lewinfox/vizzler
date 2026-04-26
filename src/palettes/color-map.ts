// Audio rotates the palette around the wheel. Spatial noise still owns the
// dominant term in the kaleidoscope's palette index; these weights just shift
// WHERE in the palette each pixel lands. Re-randomized on every regime
// switch so each section of the song "speaks" a different color language.

export interface ColorMap {
  weights: { x: number; y: number; z: number; w: number }; // (centroid, bass, mid, hi)
  base: number; // resting palette offset for the regime
}

export function makeColorMap(): ColorMap {
  return {
    weights: { x: 0.5, y: 0, z: 0, w: 0 },
    base: 0,
  };
}

export function randomizeColorMap(cm: ColorMap): void {
  const r = () => Math.random() * 2 - 1;
  cm.weights = {
    x: 0.3 + 0.6 * Math.random(), // centroid weight, biased positive
    y: 0.7 * r(),
    z: 0.7 * r(),
    w: 0.7 * r(),
  };
  cm.base = Math.random();
}
