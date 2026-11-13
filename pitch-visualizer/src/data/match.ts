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
  /**
   * Opponents around the player on the ball as the action starts,
   * estimated by eye from the frame. Absent where the frame does not show it.
   */
  pressure?: { within5: number; nearest: number };
}

export interface Sequence {
  id: string;
  label: string;
  title: string;
  end: number;
  score: string;
  /** Seconds to add to the match clock to get the time in the source clip. */
  videoOffset: number;
  /** Coaching notes drawn from the tagged events. */
  notes: string[];
  events: MatchEvent[];
}

interface Dataset {
  match: {
    title: string; competition: string; home: string; away: string; result: string; window: string;
    footage: { grade: string; kind: string; rights: string; method: string };
  };
  /** src: clip file next to the published page, loaded over http(s); the device picker is the fallback. */
  clip: { fps: number; frames: number; src?: string };
  sequences: Sequence[];
}

/**
 * The dataset is embedded in index.html as <script type="application/json" id="tracking-data">,
 * so the standalone file carries its own data and can be edited without a rebuild.
 * Coordinates are metres: x from the left goal line (0-105), y from the near touchline (0-68).
 */
const DATA: Dataset = JSON.parse(document.getElementById('tracking-data')!.textContent!);
export const MATCH = DATA.match;
export const CLIP = DATA.clip;
export const SEQUENCES = DATA.sequences;

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

export type PressureLevel = 'high' | 'medium' | 'low';
export function pressureLevel(p: NonNullable<MatchEvent['pressure']>): PressureLevel {
  if (p.within5 >= 2 || p.nearest <= 1.5) return 'high';
  return p.within5 === 1 ? 'medium' : 'low';
}

/** 12 x 8 zone name: columns A-L from the left goal line, rows 1-8 from the near touchline. */
export function zoneName(x: number, y: number): string {
  const col = Math.max(0, Math.min(11, Math.floor((x / 105) * 12)));
  const row = Math.max(0, Math.min(7, Math.floor((y / 68) * 8)));
  return `${'ABCDEFGHIJKL'[col]}${row + 1}`;
}
