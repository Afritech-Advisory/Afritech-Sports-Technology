import { PITCH } from '../pitch/dimensions';
import type { Team } from './match';

/**
 * Which goal each team attacks in the sequence on screen: 'left' is x = 0, 'right' is x = 105.
 * Set from the dataset each time a sequence loads, so teams can change ends between halves.
 */
let attack: Record<Team, 'left' | 'right'> = {};
export function setAttack(next: Record<Team, 'left' | 'right'>): void {
  attack = next;
}
export function goalX(team: Team): number {
  return attack[team] === 'right' ? PITCH.length : 0;
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
