/**
 * Coordinate mapping from tracker output to pitch metres.
 * Pitch space: x 0-105 from the left goal line, y 0-68 from the near touchline.
 * This file has no imports so it can be run and tested on its own.
 */
export type Units = 'metres' | 'normalised' | 'pixels';
export type XY = [number, number];

export interface CoordinateSpec {
  units: Units;
  /** For 'normalised': where (0, 0) sits. Trackers usually put it top-left, the far touchline. */
  origin?: 'near-left' | 'far-left';
  /** For 'pixels': row-major 3 x 3 matrix taking image pixels to pitch metres. */
  homography?: number[];
  pitch?: { length: number; width: number };
}

const DEFAULT_PITCH = { length: 105, width: 68 };

export function applyHomography(h: number[], [x, y]: XY): XY {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

/**
 * Homography from four image points to four pitch points, for example the
 * corners of a penalty area picked out on a video frame.
 */
export function homographyFromPoints(image: XY[], pitch: XY[]): number[] {
  if (image.length !== 4 || pitch.length !== 4) throw new Error('Four point pairs are required.');
  const a: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = image[i], [u, v] = pitch[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  // Gaussian elimination with partial pivoting on the 8 x 9 augmented matrix
  for (let c = 0; c < 8; c++) {
    let pivot = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    if (Math.abs(a[pivot][c]) < 1e-12) throw new Error('Point pairs are degenerate (three in a line).');
    [a[c], a[pivot]] = [a[pivot], a[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let k = c; k < 9; k++) a[r][k] -= f * a[c][k];
    }
  }
  return [...a.map((row, i) => row[8] / row[i]), 1];
}

export function toPitchMetres(p: XY, spec: CoordinateSpec): XY {
  const pitch = spec.pitch ?? DEFAULT_PITCH;
  switch (spec.units) {
    case 'metres':
      return [p[0], p[1]];
    case 'normalised': {
      const y = spec.origin === 'far-left' ? 1 - p[1] : p[1];
      return [p[0] * pitch.length, y * pitch.width];
    }
    case 'pixels':
      if (!spec.homography || spec.homography.length !== 9) {
        throw new Error("Pixel coordinates need a 9-number 'homography'.");
      }
      return applyHomography(spec.homography, p);
  }
}
