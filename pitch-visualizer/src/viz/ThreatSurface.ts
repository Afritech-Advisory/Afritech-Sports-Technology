import { CanvasTexture, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import { xT } from '../data/models';
import type { Team } from '../data/match';
import { PITCH } from '../pitch/dimensions';

const RES = 4; // pixels per metre
const STOPS: [number, [number, number, number]][] = [
  [0.0, [72, 205, 190]],
  [0.3, [110, 222, 206]],
  [0.55, [238, 96, 160]],
  [0.8, [255, 150, 110]],
  [1.0, [255, 208, 96]],
];

function ramp(t: number): [number, number, number] {
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [t0, a] = STOPS[i - 1], [t1, b] = STOPS[i];
      const k = (t - t0) / (t1 - t0);
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

// Value noise gives the wash its uneven, hand-painted edge.
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, y: number) => noise(x, y) * 0.6 + noise(x * 2.3, y * 2.3) * 0.28 + noise(x * 5.1, y * 5.1) * 0.12;

/** Expected-threat wash painted onto the pitch for one attacking team. */
export class ThreatSurface {
  readonly mesh: Mesh;
  private readonly canvas = document.createElement('canvas');
  private readonly texture: CanvasTexture;

  constructor() {
    this.canvas.width = PITCH.length * RES;
    this.canvas.height = PITCH.width * RES;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.minFilter = LinearFilter;
    this.mesh = new Mesh(
      new PlaneGeometry(PITCH.length, PITCH.width),
      new MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, opacity: 0.9 }),
    );
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.012;
  }

  paint(team: Team): void {
    const w = this.canvas.width, h = this.canvas.height;
    const ctx = this.canvas.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const x = (px + 0.5) / RES;
        const y = PITCH.width - (py + 0.5) / RES; // canvas top is the far touchline
        const n = fbm(x / 9, y / 9) - 0.5;
        let t = Math.sqrt(xT(x, y, team) / 0.3) + n * 0.2;
        t = Math.max(0, Math.min(1, (t - 0.2) / 0.72));
        // Soft banding, like layered washes drying at different rates
        const bands = 6;
        const f = t * bands, fl = Math.floor(f), fr = f - fl;
        const tb = (fl + Math.min(1, fr * fr * 3)) / bands;
        const [r, g, b] = ramp(Math.min(1, tb));
        const alpha = Math.min(1, t * 5) * (0.5 + 0.42 * tb) * (0.82 + 0.36 * noise(x / 2.5, y / 2.5));
        const i = (py * w + px) * 4;
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b;
        img.data[i + 3] = Math.max(0, Math.min(255, alpha * 255));
      }
    }
    ctx.putImageData(img, 0, 0);
    this.texture.needsUpdate = true;
  }
}
