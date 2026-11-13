import {
  AdditiveBlending, CanvasTexture, CatmullRomCurve3, ConeGeometry, Group, Mesh, MeshBasicMaterial,
  Sprite, SpriteMaterial, TubeGeometry, Vector3, type Camera,
} from 'three';
import { toPitchMetres, type CoordinateSpec } from '../data/coordinates';
import { toWorld } from '../pitch/dimensions';

/** One ball path: waypoints as [x, y] or [x, y, height in metres]. */
export interface TrackingPass {
  id: string;
  team: string;
  kind?: 'pass' | 'shot';
  /** False for a pass that did not reach a team-mate. Drawn fainter. */
  complete?: boolean;
  points: number[][];
}

/** The JSON document the builder accepts. */
export interface TrackingClip extends CoordinateSpec {
  passes: TrackingPass[];
}

export interface LaneOptions {
  colors: Record<string, number>;
  /** Lowest height of any lane above the grass, metres. */
  hover?: number;
}

export interface Lane {
  pass: TrackingPass;
  curve: CatmullRomCurve3;
  /** Draw the lane from its start up to fraction k (0-1). */
  setReveal(k: number): void;
}

export interface PassingLanes {
  group: Group;
  lanes: Lane[];
  /** Call once per frame so arrows and vertex glows hold their size on screen. */
  update(camera: Camera, elapsed: number): void;
}

const SEGMENTS = 64, RADIAL = 8;
const UP = new Vector3(0, 1, 0);
const tmp = new Vector3();

let glowTexture: CanvasTexture | null = null;
function glow(): CanvasTexture {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return (glowTexture = new CanvasTexture(c));
}

/**
 * Turns tracked ball paths into volumetric passing lanes.
 * Accepts the clip as an object or a JSON string, in metres, normalised
 * units or image pixels with a homography (see data/coordinates.ts).
 */
export function buildPassingLanes(input: TrackingClip | string, options: LaneOptions): PassingLanes {
  const clip: TrackingClip = typeof input === 'string' ? JSON.parse(input) : input;
  if (!clip || !Array.isArray(clip.passes)) throw new Error("Tracking JSON needs a 'passes' array.");
  const hover = options.hover ?? 0.6;
  const group = new Group();
  const scalers: { obj: Sprite | Mesh; base: number; pulse: number }[] = [];

  const lanes = clip.passes.map((pass, index): Lane => {
    if (!Array.isArray(pass.points) || pass.points.length < 2) {
      throw new Error(`Pass '${pass.id ?? index}' needs at least two points.`);
    }
    const pts = pass.points.map((p) => {
      const [x, y] = toPitchMetres([p[0], p[1]], clip);
      return toWorld(x, y, Math.max(hover, p[2] ?? 0));
    });
    const curve = new CatmullRomCurve3(pts, false, 'centripetal');
    const color = options.colors[pass.team] ?? 0xffffff;
    const shot = pass.kind === 'shot';
    const faint = pass.complete === false;

    // Volume: a solid core inside a translucent additive shell
    const core = new Mesh(
      new TubeGeometry(curve, SEGMENTS, shot ? 0.34 : 0.24, RADIAL),
      new MeshBasicMaterial({ color, transparent: true, opacity: faint ? 0.45 : 1 }),
    );
    const shell = new Mesh(
      new TubeGeometry(curve, SEGMENTS, shot ? 1.15 : 0.85, RADIAL),
      new MeshBasicMaterial({
        color, transparent: true, opacity: faint ? 0.07 : 0.2, blending: AdditiveBlending, depthWrite: false,
      }),
    );
    group.add(core, shell);

    // Glowing vertex at every tracked waypoint
    const vertices = pts.map((p, i) => {
      const s = new Sprite(new SpriteMaterial({
        map: glow(), color, transparent: true, opacity: faint ? 0.5 : 0.95,
        blending: AdditiveBlending, depthWrite: false,
      }));
      s.position.copy(p);
      group.add(s);
      scalers.push({ obj: s, base: 0.028, pulse: index * 1.7 + i });
      return { sprite: s, at: i / (pts.length - 1) };
    });

    // Translucent arrows floating just above the lane, pointing along the ball's travel
    const length = curve.getLength();
    const count = Math.max(1, Math.min(3, Math.round(length / 16)));
    const arrows = Array.from({ length: count }, (_, i) => {
      const at = (i + 1) / (count + 1);
      const cone = new Mesh(
        new ConeGeometry(0.5, 1.5, 14),
        new MeshBasicMaterial({ color, transparent: true, opacity: faint ? 0.28 : 0.58, depthWrite: false }),
      );
      cone.position.copy(curve.getPointAt(at)).y += 1.3;
      cone.quaternion.setFromUnitVectors(UP, curve.getTangentAt(at).normalize());
      group.add(cone);
      scalers.push({ obj: cone, base: 0.015, pulse: -1 });
      return { cone, at };
    });

    return {
      pass, curve,
      setReveal(k: number) {
        const on = k > 0;
        core.visible = shell.visible = on;
        const n = Math.floor(k * SEGMENTS) * RADIAL * 6;
        core.geometry.setDrawRange(0, n);
        shell.geometry.setDrawRange(0, n);
        for (const v of vertices) v.sprite.visible = on && k >= v.at - 0.001;
        for (const a of arrows) a.cone.visible = k >= a.at + 0.04;
      },
    };
  });

  return {
    group, lanes,
    update(camera, elapsed) {
      for (const s of scalers) {
        if (!s.obj.visible) continue;
        // Size follows camera distance, within limits, so marks stay legible from any orbit
        const d = camera.position.distanceTo(s.obj.getWorldPosition(tmp));
        const breathe = s.pulse < 0 ? 1 : 1 + 0.12 * Math.sin(elapsed * 2.4 + s.pulse);
        s.obj.scale.setScalar(Math.max(0.9, Math.min(5, d * s.base)) * breathe);
      }
    },
  };
}
