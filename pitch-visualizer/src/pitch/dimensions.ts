import { Vector3 } from 'three';

/** FIFA standard international pitch, metres. 1 world unit = 1 metre. */
export const PITCH = {
  length: 105,
  width: 68,
  penaltyAreaDepth: 16.5,
  penaltyAreaWidth: 40.32,
  goalAreaDepth: 5.5,
  goalAreaWidth: 18.32,
  penaltySpot: 11,
  circleRadius: 9.15,
  cornerRadius: 1,
  goalWidth: 7.32,
  goalHeight: 2.44,
  goalDepth: 2,
  line: 0.22, // drawn wider than the 0.12 m maximum so it stays visible at distance
  apron: 4,
  slab: 2.4,
} as const;

/**
 * Pitch coordinates: x 0-105 from the left goal line, y 0-68 from the near
 * (camera-side) touchline. World: X right, Y up, Z toward the camera.
 */
export function toWorld(x: number, y: number, h = 0): Vector3 {
  return new Vector3(x - PITCH.length / 2, h, PITCH.width / 2 - y);
}
