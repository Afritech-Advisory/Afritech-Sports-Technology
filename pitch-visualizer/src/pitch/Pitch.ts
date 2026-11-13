import {
  BoxGeometry, BufferGeometry, CircleGeometry, DoubleSide, Float32BufferAttribute, Group,
  LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PlaneGeometry, RingGeometry,
} from 'three';
import { PITCH as P } from './dimensions';

const CHALK = 0xece8dc;
const LINE_Y = 0.03;

/** Pitch slab with regulation markings, goals and the 12 x 8 zone grid. */
export class Pitch {
  readonly group = new Group();
  readonly zoneGrid: LineSegments;

  private readonly lineMat = new MeshBasicMaterial({
    color: CHALK, transparent: true, opacity: 0.92, side: DoubleSide,
  });

  constructor() {
    const L = P.length, W = P.width, a = P.apron;

    const slab = new Mesh(
      new BoxGeometry(L + a * 2, P.slab, W + a * 2),
      [0x1b1e24, 0x1b1e24, 0x2a2e36, 0x14161a, 0x1b1e24, 0x1b1e24].map(
        (c) => new MeshStandardMaterial({ color: c, roughness: 0.95, metalness: 0 }),
      ),
    );
    slab.position.y = -P.slab / 2;
    this.group.add(slab);

    // Outline and halfway line
    this.rect(-L / 2, -W / 2, L / 2, W / 2);
    this.segment(0, -W / 2, 0, W / 2);
    this.ring(0, 0, P.circleRadius);
    this.spot(0, 0);

    for (const s of [-1, 1]) {
      const gx = (s * L) / 2;
      this.rect(gx, -P.penaltyAreaWidth / 2, gx - s * P.penaltyAreaDepth, P.penaltyAreaWidth / 2);
      this.rect(gx, -P.goalAreaWidth / 2, gx - s * P.goalAreaDepth, P.goalAreaWidth / 2);
      const spotX = gx - s * P.penaltySpot;
      this.spot(spotX, 0);
      // Penalty arc: the part of the 9.15 m circle outside the penalty area
      const half = Math.acos((P.penaltyAreaDepth - P.penaltySpot) / P.circleRadius);
      this.ring(spotX, 0, P.circleRadius, s === 1 ? Math.PI - half : -half, half * 2);
      // Corner arcs
      for (const t of [-1, 1]) {
        const start = s === -1 ? (t === -1 ? -Math.PI / 2 : 0) : (t === -1 ? Math.PI : Math.PI / 2);
        this.ring(gx, (t * W) / 2, P.cornerRadius, start, Math.PI / 2);
      }
      this.group.add(this.goal(gx, s));
    }

    this.zoneGrid = this.buildZoneGrid();
    this.group.add(this.zoneGrid);
  }

  private segment(x1: number, z1: number, x2: number, z2: number): void {
    const len = Math.hypot(x2 - x1, z2 - z1) + P.line;
    const m = new Mesh(new PlaneGeometry(len, P.line), this.lineMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(z2 - z1, x2 - x1);
    m.position.set((x1 + x2) / 2, LINE_Y, (z1 + z2) / 2);
    this.group.add(m);
  }

  private rect(x1: number, z1: number, x2: number, z2: number): void {
    this.segment(x1, z1, x2, z1);
    this.segment(x2, z1, x2, z2);
    this.segment(x2, z2, x1, z2);
    this.segment(x1, z2, x1, z1);
  }

  /** thetaStart is measured in the ground plane, counter-clockwise seen from above. */
  private ring(x: number, z: number, r: number, thetaStart = 0, thetaLength = Math.PI * 2): void {
    const m = new Mesh(
      new RingGeometry(r - P.line / 2, r + P.line / 2, 96, 1, thetaStart, thetaLength),
      this.lineMat,
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, LINE_Y, z);
    this.group.add(m);
  }

  private spot(x: number, z: number): void {
    const m = new Mesh(new CircleGeometry(0.32, 20), this.lineMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, LINE_Y, z);
    this.group.add(m);
  }

  private goal(gx: number, s: number): LineSegments {
    const w = P.goalWidth / 2, h = P.goalHeight, d = s * P.goalDepth;
    const v: number[] = [];
    const add = (...p: number[]) => v.push(...p);
    // Frame
    add(gx, 0, -w, gx, h, -w, gx, h, -w, gx, h, w, gx, h, w, gx, 0, w);
    // Net
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const z = -w + (i / n) * 2 * w;
      add(gx, h, z, gx + d, h * 0.72, z, gx + d, h * 0.72, z, gx + d, 0, z);
    }
    for (let j = 0; j <= 3; j++) {
      const y = (j / 3) * h * 0.72;
      add(gx + d, y, -w, gx + d, y, w);
      for (const z of [-w, w]) add(gx, (j / 3) * h, z, gx + d, y, z);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(v, 3));
    return new LineSegments(g, new LineBasicMaterial({ color: CHALK, transparent: true, opacity: 0.8 }));
  }

  private buildZoneGrid(): LineSegments {
    const L = P.length, W = P.width, v: number[] = [];
    for (let i = 1; i < 12; i++) {
      const x = -L / 2 + (i * L) / 12;
      v.push(x, 0.02, -W / 2, x, 0.02, W / 2);
    }
    for (let j = 1; j < 8; j++) {
      const z = -W / 2 + (j * W) / 8;
      v.push(-L / 2, 0.02, z, L / 2, 0.02, z);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(v, 3));
    return new LineSegments(g, new LineBasicMaterial({ color: CHALK, transparent: true, opacity: 0.13 }));
  }
}
