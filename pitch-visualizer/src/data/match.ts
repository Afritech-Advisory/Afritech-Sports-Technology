import { xG, xT } from './models';

export type Team = 'KEN' | 'CIV';
export type EventType =
  | 'throw_in' | 'pass' | 'cross' | 'carry' | 'take_on' | 'shot'
  | 'clearance' | 'recovery' | 'tackle' | 'claim' | 'gk_kick';

export interface MatchEvent {
  /** Match clock, seconds. */
  t: number;
  team: Team;
  type: EventType;
  /** Shirt number where legible in the footage. */
  player?: number;
  from: [number, number];
  to?: [number, number];
  outcome: 'complete' | 'incomplete' | 'goal' | 'won' | 'lost';
  note?: string;
}

export interface Sequence {
  id: string;
  label: string;
  title: string;
  end: number;
  score: string;
  events: MatchEvent[];
}

const c = (m: number, s: number) => m * 60 + s;

export const MATCH = {
  home: 'Kenya U23',
  away: 'Ivory Coast U23',
  result: '2–1',
  window: "Second half, 64' to 90+6'",
  footage: {
    grade: 'A',
    kind: 'Broadcast highlights reel, 640 × 360, 6 min 35 s',
    rights: 'Third-party broadcast, rights not cleared. Internal demonstration only.',
    method: 'Positions hand-tagged from the main camera, accurate to roughly ±5 m.',
  },
} as const;

/**
 * Pitch coordinates in metres: x from the left goal line (0-105),
 * y from the near touchline (0-68). Kenya attack toward x = 0.
 */
export const SEQUENCES: Sequence[] = [
  {
    id: 'g1', label: "64'", title: 'Kenya 1–0', end: c(64, 30), score: '1–0',
    events: [
      { t: c(64, 17), team: 'KEN', type: 'throw_in', from: [48, 68], to: [41, 61], outcome: 'complete' },
      { t: c(64, 19), team: 'KEN', type: 'carry', from: [41, 61], to: [20, 57], outcome: 'complete' },
      { t: c(64, 22), team: 'KEN', type: 'cross', from: [20, 57], to: [7, 40], outcome: 'incomplete' },
      { t: c(64, 23), team: 'CIV', type: 'clearance', from: [6, 38], to: [19, 30], outcome: 'incomplete' },
      { t: c(64, 25), team: 'KEN', type: 'recovery', from: [19, 30], outcome: 'won' },
      {
        t: c(64, 27), team: 'KEN', type: 'shot', from: [18, 32], to: [0, 35.5], outcome: 'goal',
        note: 'Struck from the edge of the area. Scorer to confirm on the match sheet; No. 10 leads the celebration.',
      },
    ],
  },
  {
    id: 'k70', label: "70'", title: 'Kenya box entry', end: c(70, 27), score: '1–0',
    events: [
      { t: c(70, 18), team: 'KEN', type: 'carry', from: [50, 60], to: [24, 50], outcome: 'complete' },
      { t: c(70, 23), team: 'KEN', type: 'carry', from: [24, 50], to: [13, 42], outcome: 'complete' },
      { t: c(70, 25), team: 'CIV', type: 'tackle', from: [13, 42], outcome: 'won', note: 'Challenge inside the area, two players go down. No shot.' },
    ],
  },
  {
    id: 'g2', label: "73'", title: 'Ivory Coast 1–1', end: c(73, 16), score: '1–1',
    events: [
      { t: c(73, 3), team: 'CIV', type: 'pass', from: [48, 56], to: [74, 14], outcome: 'complete', note: 'Switch from the far side into the near channel.' },
      { t: c(73, 5), team: 'CIV', type: 'carry', from: [74, 14], to: [99, 5], outcome: 'complete' },
      { t: c(73, 10), team: 'CIV', type: 'cross', from: [99, 5], to: [92, 44], outcome: 'complete' },
      { t: c(73, 13), team: 'CIV', type: 'shot', from: [93, 43], to: [105, 36], outcome: 'goal', note: 'Finish from the far side of the area. Shirt number not legible.' },
    ],
  },
  {
    id: 'g3', label: "83'", title: 'Kenya 2–1', end: c(83, 35), score: '2–1',
    events: [
      { t: c(83, 0), team: 'KEN', type: 'pass', player: 1, from: [96, 34], to: [72, 42], outcome: 'complete', note: 'Goalkeeper distribution.' },
      { t: c(83, 2), team: 'KEN', type: 'carry', from: [72, 42], to: [58, 40], outcome: 'complete' },
      { t: c(83, 8), team: 'CIV', type: 'tackle', from: [55, 38], outcome: 'won' },
      { t: c(83, 10), team: 'KEN', type: 'recovery', from: [52, 36], outcome: 'won' },
      { t: c(83, 11), team: 'KEN', type: 'carry', from: [52, 36], to: [40, 30], outcome: 'complete' },
      { t: c(83, 15), team: 'KEN', type: 'pass', from: [40, 30], to: [27, 9], outcome: 'complete' },
      { t: c(83, 17), team: 'KEN', type: 'take_on', player: 8, from: [27, 9], to: [23, 6], outcome: 'lost' },
      { t: c(83, 21), team: 'CIV', type: 'recovery', player: 3, from: [31, 3], outcome: 'won' },
      { t: c(83, 26), team: 'KEN', type: 'tackle', from: [36, 6], outcome: 'won', note: 'High regain by the near touchline.' },
      { t: c(83, 27), team: 'KEN', type: 'pass', from: [35, 8], to: [23, 30], outcome: 'complete' },
      { t: c(83, 29), team: 'KEN', type: 'carry', player: 17, from: [23, 30], to: [13, 33], outcome: 'complete' },
      { t: c(83, 31), team: 'KEN', type: 'shot', player: 17, from: [12, 33], to: [0, 32], outcome: 'goal', note: 'Finish from inside the area after the regain.' },
    ],
  },
  {
    id: 'k96', label: "90+6'", title: 'Kenya ball claimed', end: c(96, 26), score: '2–1',
    events: [
      { t: c(96, 14), team: 'KEN', type: 'pass', from: [32, 40], to: [9, 36], outcome: 'incomplete' },
      { t: c(96, 17), team: 'CIV', type: 'claim', player: 1, from: [6, 35], outcome: 'won' },
      { t: c(96, 22), team: 'CIV', type: 'gk_kick', player: 1, from: [9, 33], to: [52, 26], outcome: 'incomplete' },
    ],
  },
];

/** Opta-compatible naming for the event log. Carries are derived, as in Opta feeds. */
export const EVENT_META: Record<EventType, { label: string; opta: string; aerial: number }> = {
  throw_in: { label: 'Throw-in', opta: 'Pass (1), throw-in', aerial: 0.3 },
  pass: { label: 'Pass', opta: 'Pass (1)', aerial: 0.24 },
  cross: { label: 'Cross', opta: 'Pass (1), cross', aerial: 0.32 },
  carry: { label: 'Carry', opta: 'Carry (derived)', aerial: 0 },
  take_on: { label: 'Take-on', opta: 'Take On (3)', aerial: 0 },
  shot: { label: 'Shot', opta: 'Goal (16)', aerial: 0.16 },
  clearance: { label: 'Clearance', opta: 'Clearance (12)', aerial: 0.3 },
  recovery: { label: 'Recovery', opta: 'Ball recovery (49)', aerial: 0 },
  tackle: { label: 'Tackle', opta: 'Tackle (7)', aerial: 0 },
  claim: { label: 'Keeper claim', opta: 'Claim (11)', aerial: 0 },
  gk_kick: { label: 'Keeper kick', opta: 'Pass (1), long ball', aerial: 0.3 },
};

export const clock = (t: number) =>
  t >= 90 * 60
    ? `90+${Math.floor(t / 60) - 90}:${String(t % 60).padStart(2, '0')}`
    : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;

/** Threat added by moving the ball, credited only when the action succeeds. */
export function deltaXT(e: MatchEvent): number | null {
  if (!e.to || e.type === 'shot' || e.type === 'clearance') return null;
  if (e.outcome !== 'complete') return null;
  return xT(e.to[0], e.to[1], e.team) - xT(e.from[0], e.from[1], e.team);
}

export function shotXG(e: MatchEvent): number | null {
  return e.type === 'shot' ? xG(e.from[0], e.from[1], e.team) : null;
}

export function eventDuration(seq: Sequence, i: number): number {
  const next = i + 1 < seq.events.length ? seq.events[i + 1].t : seq.end;
  const e = seq.events[i];
  return Math.max(0.8, Math.min(next - e.t, e.type === 'shot' ? 1.4 : 6));
}
