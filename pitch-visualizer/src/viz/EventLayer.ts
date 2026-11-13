import {
  BufferGeometry, CatmullRomCurve3, CircleGeometry, Curve, DoubleSide, Group, Line,
  LineDashedMaterial, Mesh, MeshBasicMaterial, RingGeometry, SphereGeometry, Vector3, type Camera,
} from 'three';
import { buildPassingLanes, type Lane, type PassingLanes, type TrackingClip } from './PassingLanes';
import {
  EVENT_META, deltaXT, eventDuration, shotXG, type MatchEvent, type Sequence, type Team,
} from '../data/match';
import { toWorld } from '../pitch/dimensions';

export const TEAM_COLOR: Record<Team, number> = { KEN: 0x9cc2ff, CIV: 0xffe9c4 };
const KIT: Record<Team, number> = { KEN: 0xe5343f, CIV: 0xf6f3ec };
const SEGMENTS = 56;

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
  lane: Lane | null;
  line: Line | null;
  marker: Group;
  ring: Mesh | null;
  label: EventLabel | null;
}

const passId = (seq: Sequence, i: number) => `${seq.id}-${i}`;

/**
 * Tagged ball-path events as a tracking clip, in metres.
 * These waypoints come from the hand-tagged log, not from an automated tracker.
 */
export function sequenceToTracking(seq: Sequence): TrackingClip {
  return {
    units: 'metres',
    passes: seq.events.flatMap((e, i) => {
      const aerial = EVENT_META[e.type].aerial;
      if (!e.to || aerial <= 0) return [];
      const dist = Math.hypot(e.to[0] - e.from[0], e.to[1] - e.from[1]);
      const apex = Math.max(2.5, dist * aerial);
      const shot = e.type === 'shot';
      return [{
        id: passId(seq, i), team: e.team, kind: shot ? 'shot' as const : 'pass' as const,
        complete: e.outcome !== 'incomplete',
        // Five samples along a parabolic flight between the tagged start and end
        points: [0, 0.25, 0.5, 0.75, 1].map((u) => [
          e.from[0] + (e.to![0] - e.from[0]) * u,
          e.from[1] + (e.to![1] - e.from[1]) * u,
          0.6 + (shot && u === 1 ? 0.5 : 0) + apex * 4 * u * (1 - u),
        ]),
      }];
    }),
  };
}

/** Draws one sequence: ball paths as arcs, carries as dashed runs, duels as rings. */
export class EventLayer {
  readonly group = new Group();
  readonly ball: Mesh;
  labels: EventLabel[] = [];
  private items: Item[] = [];
  private goalFlash: Mesh;
  private lanes: PassingLanes | null = null;

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

    // Ball paths go through the tracking-JSON route, the same one tracker output would take
    const clip = sequenceToTracking(seq);
    this.lanes = buildPassingLanes(clip, { colors: TEAM_COLOR });
    this.group.add(this.lanes.group);
    const laneById = new Map(this.lanes.lanes.map((l) => [l.pass.id, l]));

    seq.events.forEach((event, i) => {
      const meta = EVENT_META[event.type];
      const a = toWorld(event.from[0], event.from[1], 0.3);
      const item: Item = {
        event, start: event.t, duration: eventDuration(seq, i),
        curve: null, lane: laneById.get(passId(seq, i)) ?? null, line: null, marker: this.playerMarker(event, a), ring: null, label: null,
      };
      this.group.add(item.marker);

      if (event.to) {
        const b = toWorld(event.to[0], event.to[1], 0.3);
        const dist = a.distanceTo(b);
        if (item.lane) {
          item.curve = item.lane.curve;
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
  update(t: number, elapsed: number, camera: Camera): number {
    let active = 0;
    let ballAt: Vector3 | null = null;
    let flash = 0;

    this.items.forEach((item, i) => {
      const k = Math.max(0, Math.min(1, (t - item.start) / item.duration));
      const started = t >= item.start;
      if (started) active = i;
      item.marker.visible = started;
      item.lane?.setReveal(k);
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

    this.lanes?.update(camera, elapsed);
    this.ball.visible = ballAt !== null;
    if (ballAt) this.ball.position.copy(ballAt).setY(Math.max(0.75, (ballAt as Vector3).y));
    const mat = this.goalFlash.material as MeshBasicMaterial;
    mat.opacity = flash * (0.55 + 0.4 * Math.sin(elapsed * 5));
    this.goalFlash.scale.setScalar(1 + flash * (0.25 + 0.2 * Math.sin(elapsed * 5)));
    return active;
  }
}
