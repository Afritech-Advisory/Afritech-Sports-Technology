import {
  AmbientLight, DirectionalLight, PerspectiveCamera, Scene, Timer, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type ViewName = 'broadcast' | 'tactical' | 'goal';
type FrameCallback = (dt: number, elapsed: number) => void;

const VIEWS: Record<ViewName, Vector3> = {
  broadcast: new Vector3(-0.12, 0.62, 0.78),
  tactical: new Vector3(0, 1, 0.02),
  goal: new Vector3(0.92, 0.3, 0.26),
};

/** Owns the renderer, camera, lights, controls and the render loop. */
export class SceneManager {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly controls: OrbitControls;

  private readonly timer = new Timer();
  private readonly callbacks: FrameCallback[] = [];
  private flight: { from: Vector3; to: Vector3; t: number } | null = null;
  private view: ViewName = 'broadcast';
  private userMoved = false;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    this.camera = new PerspectiveCamera(38, 1, 0.5, 1200);

    this.scene.add(new AmbientLight(0xcfd6e6, 1.15));
    const sun = new DirectionalLight(0xffffff, 1.7);
    sun.position.set(-60, 120, 80);
    this.scene.add(sun);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.rotateSpeed = 0.6;
    this.controls.zoomSpeed = 0.8;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.06;
    this.controls.minDistance = 25;
    this.controls.maxDistance = 420;
    this.controls.target.set(0, 0, 0);
    this.controls.addEventListener('start', () => {
      this.userMoved = true;
      this.flight = null;
    });

    this.resize();
    this.camera.position.copy(this.viewPosition(this.view));
    window.addEventListener('resize', () => this.resize());
    new ResizeObserver(() => this.resize()).observe(container);
  }

  /** Distance at which the whole pitch fits the viewport, portrait included. */
  private fitDistance(): number {
    const vFov = (this.camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const byWidth = 74 / Math.tan(hFov / 2);
    const byHeight = 52 / Math.tan(vFov / 2);
    return Math.min(Math.max(byWidth, byHeight), 400);
  }

  private viewPosition(name: ViewName): Vector3 {
    return VIEWS[name].clone().normalize().multiplyScalar(this.fitDistance());
  }

  setView(name: ViewName): void {
    this.view = name;
    this.userMoved = false;
    this.controls.target.set(0, 0, 0);
    this.flight = { from: this.camera.position.clone(), to: this.viewPosition(name), t: 0 };
  }

  private resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (!this.userMoved && !this.flight) this.camera.position.copy(this.viewPosition(this.view));
  }

  onFrame(cb: FrameCallback): void {
    this.callbacks.push(cb);
  }

  /** World point to CSS pixels inside the container. */
  project(p: Vector3, out: { x: number; y: number; visible: boolean }): void {
    const v = p.clone().project(this.camera);
    out.visible = v.z > -1 && v.z < 1;
    out.x = (v.x * 0.5 + 0.5) * this.container.clientWidth;
    out.y = (-v.y * 0.5 + 0.5) * this.container.clientHeight;
  }

  start(): void {
    this.renderer.setAnimationLoop((time) => {
      this.timer.update(time);
      const dt = Math.min(this.timer.getDelta(), 0.1);
      if (this.flight) {
        this.flight.t = Math.min(1, this.flight.t + dt / 0.9);
        const k = 1 - Math.pow(1 - this.flight.t, 3);
        this.camera.position.lerpVectors(this.flight.from, this.flight.to, k);
        if (this.flight.t >= 1) this.flight = null;
      }
      this.controls.update();
      for (const cb of this.callbacks) cb(dt, this.timer.getElapsed());
      this.renderer.render(this.scene, this.camera);
    });
  }
}
