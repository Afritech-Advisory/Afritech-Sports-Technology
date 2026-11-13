import { Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { goalX } from '../data/models';
import type { Team } from '../data/match';
import { PITCH } from '../pitch/dimensions';

export const MAX_POINTS = 32;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Contextual expected threat.
 * Base layer: the positional xT surface (kept in step with xT() in data/models.ts).
 * Context layer: up to MAX_POINTS intensity points, each a Gaussian in pitch metres,
 * so threat built during the current sequence lifts the surface where it happened.
 */
const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uPoints[MAX_POINTS]; // x (m), y (m), intensity 0-1
  uniform int uCount;
  uniform float uGoalX;
  uniform float uSigma;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec2 uPitch;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    return noise(p) * 0.68 + noise(p * 2.3 + 11.0) * 0.32;
  }

  float baseThreat(vec2 p) {
    float dx = abs(uGoalX - p.x);
    float dy = p.y - uPitch.y * 0.5;
    float d = length(vec2(dx, dy));
    float central = d < 0.01 ? 1.0 : dx / d;
    return 0.005 + 0.3 * exp(-d / 14.0) * (0.4 + 0.6 * pow(central, 1.5));
  }

  // Cool cyan in the defensive third, through magenta, to amber in the attacking box.
  vec3 ramp(float t) {
    vec3 cyan = vec3(0.16, 0.80, 0.90);
    vec3 teal = vec3(0.36, 0.86, 0.78);
    vec3 magenta = vec3(0.94, 0.24, 0.62);
    vec3 amber = vec3(1.00, 0.78, 0.30);
    vec3 c = mix(cyan, teal, smoothstep(0.0, 0.30, t));
    c = mix(c, magenta, smoothstep(0.30, 0.62, t));
    return mix(c, amber, smoothstep(0.66, 0.96, t));
  }

  void main() {
    vec2 p = vUv * uPitch; // pitch metres; v = 1 is the far touchline

    float heat = sqrt(baseThreat(p) / 0.3);

    float context = 0.0;
    float inv = 1.0 / (2.0 * uSigma * uSigma);
    for (int i = 0; i < MAX_POINTS; i++) {
      if (i >= uCount) break;
      vec2 d = p - uPoints[i].xy;
      context += uPoints[i].z * exp(-dot(d, d) * inv);
    }
    heat += context * 0.5;

    // Slow drifting wash so the edges read as paint, not as a hard contour
    float wash = fbm(p / 9.0 + vec2(uTime * 0.02, -uTime * 0.013)) - 0.5;
    heat = clamp(heat + wash * 0.14, 0.0, 1.0);

    float grain = 0.86 + 0.28 * noise(p / 2.5);
    float alpha = mix(0.2, 0.9, smoothstep(0.12, 0.8, heat)) * grain;

    // Feather the last metre so the wash does not cut hard at the touchlines
    vec2 edge = min(p, uPitch - p);
    alpha *= smoothstep(0.0, 1.2, min(edge.x, edge.y));

    gl_FragColor = vec4(pow(ramp(heat), vec3(2.2)), alpha * uOpacity);
    #include <colorspace_fragment>
  }
`;

/** GPU expected-threat surface. One draw call, one quad, no textures. */
export class ThreatSurface {
  readonly mesh: Mesh;
  private readonly points = new Float32Array(MAX_POINTS * 3);
  private readonly material: ShaderMaterial;

  constructor() {
    this.material = new ShaderMaterial({
      defines: { MAX_POINTS },
      uniforms: {
        uPoints: { value: this.points },
        uCount: { value: 0 },
        uGoalX: { value: 0 },
        uSigma: { value: 7 },
        uTime: { value: 0 },
        uOpacity: { value: 0.95 },
        uPitch: { value: [PITCH.length, PITCH.width] },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(PITCH.length, PITCH.width), this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.012;
  }

  setTeam(team: Team): void {
    this.material.uniforms.uGoalX.value = goalX(team);
  }

  /** Flat [x, y, intensity, ...] in pitch metres. Extra points beyond MAX_POINTS are dropped. */
  setPoints(flat: ArrayLike<number>): void {
    const n = Math.min(MAX_POINTS, Math.floor(flat.length / 3));
    for (let i = 0; i < n * 3; i++) this.points[i] = flat[i];
    this.material.uniforms.uCount.value = n;
  }

  setTime(seconds: number): void {
    this.material.uniforms.uTime.value = seconds;
  }
}
