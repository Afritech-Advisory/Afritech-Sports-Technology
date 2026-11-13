import {
  AdditiveBlending, BufferGeometry, CatmullRomCurve3, CircleGeometry, Curve, DoubleSide, Group, Line,
  LineDashedMaterial, Mesh, MeshBasicMaterial, QuadraticBezierCurve3, RingGeometry,
  SphereGeometry, TubeGeometry, Vector3,
} from 'three';
import {
  EVENT_META, deltaXT, eventDuration, shotXG, type MatchEvent, type Sequence, type Team,
} from '../data/match';
import { toWorld } from '../pitch/dimensions';

export const TEAM_COLOR: Record<Team, number> = { KEN: 0x9cc2ff, CIV: 0xffe9c4 };
const KIT: Record<Team, number> = { KEN: 0xe5343f, CIV: 0xf6f3ec };
const SEGMENTS = 56, RADIAL = 6;

export interface EventLabel {
  anchor: Vector3;
  text: string;
  kind: 'xt' | 'xg';
  event: MatchEvent;
  reveal: number;
}

interface Item {
  event: MatchEvent;
  start: number;
  duration: number;
  curve: Curve<Vector3> | null;
  tubes: Mesh[];
  line: Line | null;
  marker: Group;
  ring: Mesh | null;
  label: EventLabel | null;
}

/** Draws one sequence: ball paths as arcs, carries as dashed runs, duels as rings. */
export class EventLayer {
  readonly group = new Group();
  readonly ball: Mesh;
  labels: EventLabel[] = [];
  private items: Item[] = [];
  private goalFlash: Mesh;

  constructor() {
    this.ball = new Mesh(new SphereGeometry(0.75, 20, 14), new MeshBasicMaterial({ color: 0xffffff }));
    this.goalFlash = new Mesh(
      new RingGeometry(1.2, 1.9, 40),
      new MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false }),
    );
  }

  load(seq: Sequence): void {
    this.group.clear();
    this.items = [];
    this.labels = [];
    this.group.add(this.ball, this.goalFlash);

    seq.events.forEach((event, i) => {
      const meta = EVENT_META[event.type];
      const a = toWorld(event.from[0], event.from[1], 0.3);
      const item: Item = {
        event, start: event.t, duration: eventDuration(seq, i),
        curve: null, tubes: [], line: null, marker: this.playerMarker(event, a), ring: null, label: null,
      };
      this.group.add(item.marker);

      if (event.to) {
        const shot = event.type === 'shot';
        const b = toWorld(event.to[0], event.to[1], shot ? 1.1 : 0.3);
        const dist = a.distanceTo(b);
        if (meta.aerial > 0) {
          const mid = a.clone().lerp(b, 0.5);
          mid.y = Math.max(2.5, dist * meta.aerial * 2);
          item.curve = new QuadraticBezierCurve3(a, mid, b);
          const color = TEAM_COLOR[event.team];
          const faded = event.outcome === 'incomplete';
          const core = new Mesh(
            new TubeGeometry(item.curve, SEGMENTS, shot ? 0.34 : 0.22, RADIAL),
            new MeshBasicMaterial({ color, transparent: true, opacity: faded ? 0.45 : 1 }),
          );
          const glow = new Mesh(
            new TubeGeometry(item.curve, SEGMENTS, shot ? 1.0 : 0.7, RADIAL),
            new MeshBasicMaterial({
              color, transparent: true, opacity: faded ? 0.07 : 0.2, blending: AdditiveBlending, depthWrite: false,
            }),
          );
          item.tubes = [core, glow];
          this.group.add(core, glow);
        } else {
          // Ground run: a gentle S so overlapping carries stay readable
          const n = new Vector3(-(b.z - a.z), 0, b.x - a.x).normalize().multiplyScalar(Math.min(1.6, dist * 0.06));
          item.curve = new CatmullRomCurve3([
            a, a.clone().lerp(b, 0.33).add(n), a.clone().lerp(b, 0.66).sub(n), b,
          ]);
          const pts = item.curve.getPoints(SEGMENTS);
          const line = new Line(
            new BufferGeometry().setFromPoints(pts),
            new LineDashedMaterial({ color: TEAM_COLOR[event.team], dashSize: 1.3, gapSize: 0.9 }),
          );
          line.computeLineDistances();
          item.line = line;
          this.group.add(line);
        }
      } else {
        const ring = new Mesh(
          new RingGeometry(1.5, 1.85, 40),
          new MeshBasicMaterial({ color: TEAM_COLOR[event.team], transparent: true, opacity: 0.9, side: DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(a).setY(0.08);
        item.ring = ring;
        this.group.add(ring);
      }

      const dxt = deltaXT(event), xg = shotXG(event);
      if (item.curve && (xg !== null || (dxt !== null && Math.abs(dxt) >= 0.005))) {
        item.label = {
          anchor: item.curve.getPoint(xg !== null ? 0.3 : 0.5).add(new Vector3(0, xg !== null ? 5 : 1.2, 0)),
          text: xg !== null
            ? `xG ${xg.toFixed(2)}${event.outcome === 'goal' ? ' · goal' : ''}`
            : `xT ${dxt! >= 0 ? '+' : '−'}${Math.abs(dxt!).toFixed(3)}`,
          kind: xg !== null ? 'xg' : 'xt',
          event, reveal: 0,
        };
        this.labels.push(item.label);
      }
      this.items.push(item);
    });
  }

  private playerMarker(event: MatchEvent, at: Vector3): Group {
    const g = new Group();
    const disc = new Mesh(new CircleGeometry(0.95, 24), new MeshBasicMaterial({ color: KIT[event.team] }));
    const rim = new Mesh(
      new RingGeometry(0.95, 1.2, 24),
      new MeshBasicMaterial({ color: event.team === 'CIV' ? 0xff8a2a : 0x111318 }),
    );
    for (const m of [disc, rim]) m.rotation.x = -Math.PI / 2;
    g.add(disc, rim);
    g.position.copy(at).setY(0.06);
    return g;
  }

  /**
   * Reveal the sequence up to match-clock time `t`.
   * Returns the index of the event in progress.
   */
  update(t: number, elapsed: number): number {
    let active = 0;
    let ballAt: Vector3 | null = null;
    let flash = 0;

    this.items.forEach((item, i) => {
      const k = Math.max(0, Math.min(1, (t - item.start) / item.duration));
      const started = t >= item.start;
      if (started) active = i;
      item.marker.visible = started;
      for (const tube of item.tubes) {
        tube.visible = k > 0;
        tube.geometry.setDrawRange(0, Math.floor(k * SEGMENTS) * RADIAL * 6);
      }
      if (item.line) {
        item.line.visible = k > 0;
        item.line.geometry.setDrawRange(0, Math.max(2, Math.ceil(k * (SEGMENTS + 1))));
      }
      if (item.ring) {
        item.ring.visible = started;
        const pulse = Math.max(0, 1 - (t - item.start) / 1.2);
        item.ring.scale.setScalar(1 + pulse * 0.9);
      }
      if (item.label) item.label.reveal = k;
      if (started) {
        ballAt = item.curve ? item.curve.getPoint(k) : toWorld(item.event.from[0], item.event.from[1], 0.75);
        if (item.event.outcome === 'goal' && k >= 1 && item.event.to) {
          flash = 1;
          this.goalFlash.position.copy(toWorld(item.event.to[0], item.event.to[1], 1.2));
          this.goalFlash.rotation.y = Math.PI / 2;
        }
      }
    });

    this.ball.visible = ballAt !== null;
    if (ballAt) this.ball.position.copy(ballAt).setY(Math.max(0.75, (ballAt as Vector3).y));
    const mat = this.goalFlash.material as MeshBasicMaterial;
    mat.opacity = flash * (0.55 + 0.4 * Math.sin(elapsed * 5));
    this.goalFlash.scale.setScalar(1 + flash * (0.25 + 0.2 * Math.sin(elapsed * 5)));
    return active;
  }
}
