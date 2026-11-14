import { PITCH } from '../pitch/dimensions';
import type { Team } from './match';

/**
 * Which goal each team attacks: 'left' is x = 0, 'right' is x = 105.
 * Comes from the dataset (team default, overridden per sequence because teams change ends at
 * half-time) and is set by setAttacks() whenever a sequence is loaded.
 */
const attacks = new Map<Team, 'left' | 'right'>();
export function setAttacks(directions: Record<Team, 'left' | 'right'>): void {
  attacks.clear();
  for (const [team, side] of Object.entries(directions)) attacks.set(team, side);
}
export function goalX(team: Team): number {
  return attacks.get(team) === 'left' ? 0 : PITCH.length;
}

/**
 * Expected threat at a pitch location for the attacking team.
 * This is a smooth generic approximation of a published-style xT surface
 * (about 0.005 in the defensive third rising to about 0.3 in the goal mouth).
 * It has not been fitted to this match or competition.
 * The same formula is evaluated per pixel in viz/ThreatSurface.ts; change both together.
 */
export function xT(x: number, y: number, team: Team): number {
  const dx = Math.abs(goalX(team) - x);
  const dy = y - PITCH.width / 2;
  const d = Math.hypot(dx, dy);
  const centrality = d < 0.01 ? 1 : dx / d;
  return 0.005 + 0.3 * Math.exp(-d / 14) * (0.4 + 0.6 * Math.pow(centrality, 1.5));
}

/** Geometric expected goals from distance and visible goal angle only. */
export function xG(x: number, y: number, team: Team): number {
  const dx = Math.abs(goalX(team) - x);
  const dy = y - PITCH.width / 2;
  const d = Math.hypot(dx, dy);
  const half = PITCH.goalWidth / 2;
  const angle = Math.atan2(PITCH.goalWidth * dx, dx * dx + dy * dy - half * half);
  const a = angle < 0 ? angle + Math.PI : angle;
  return 1 / (1 + Math.exp(-(-3.1 + 3.0 * a - 0.05 * d)));
}
