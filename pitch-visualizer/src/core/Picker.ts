import { Raycaster, Vector2, type Intersection, type Object3D } from 'three';
import type { SceneManager } from './SceneManager';

/**
 * Click and tap picking. A press that moves more than a few pixels is an orbit
 * drag, not a click, so it never selects anything.
 */
export class Picker {
  private readonly ray = new Raycaster();
  private readonly ndc = new Vector2();
  private down: { x: number; y: number } | null = null;

  constructor(
    private readonly sm: SceneManager,
    private readonly targets: () => Object3D[],
    private readonly onPick: (hit: Intersection | null) => void,
  ) {
    this.ray.params.Line = { threshold: 1.6 };
    const el = sm.renderer.domElement;
    el.addEventListener('pointerdown', (e) => { this.down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
      this.onPick(this.cast(e));
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || e.buttons) return;
      el.style.cursor = this.cast(e) ? 'pointer' : 'grab';
    });
  }

  private cast(e: PointerEvent): Intersection | null {
    const r = this.sm.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.sm.camera);
    return this.ray.intersectObjects(this.targets(), false)[0] ?? null;
  }
}
