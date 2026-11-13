import { xG, xT } from './models';

/** A team code from the dataset's `teams` list, for example 'KEN'. */
export type Team = string;
export type Side = 'left' | 'right';

export interface TeamInfo {
  code: Team;
  name: string;
  /** Shirt colour: the player mark and the dot beside the team name. */
  kit: string;
  /** Rim of the player mark on the pitch. */
  trim: string;
  /** Ball paths, carries and value tags. */
  lane: string;
  /** Underline, timeline ticks and the ring round the dot. Defaults to the kit colour. */
  accent?: string;
}
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
  /** Goal each team attacks in this sequence, where it differs from the dataset's `attack`. */
  attack?: Record<Team, Side>;
  events: MatchEvent[];
}

interface Dataset {
  match: {
    title: string; competition: string; home: string; away: string; result: string; window: string;
    footage: { grade: string; kind: string; rights: string; method: string };
    /** Goals scored before the first tagged sequence, home then away. */
    startScore?: [number, number];
  };
  /** Home team first. Absent in the first dataset (Kenya U23 v Ivory Coast U23), which uses the defaults below. */
  teams?: [TeamInfo, TeamInfo];
  /** Goal each team attacks: 'left' is x = 0, 'right' is x = 105. A sequence can override it. */
  attack?: Record<Team, Side>;
  /** Id of the sequence shown when the page opens. Defaults to the last one with a goal. */
  open?: string;
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

/** Colours of the reference build, used when the dataset has no `teams` list. */
const DEFAULT_TEAMS: [TeamInfo, TeamInfo] = [
  { code: 'KEN', name: 'Kenya', kit: '#e5343f', trim: '#111318', lane: '#9cc2ff' },
  { code: 'CIV', name: 'Ivory Coast', kit: '#f6f3ec', trim: '#ff8a2a', lane: '#ffe9c4', accent: '#ff8a2a' },
];
export const TEAMS: [TeamInfo, TeamInfo] = DATA.teams ?? DEFAULT_TEAMS;
const codes = TEAMS.map((t) => t.code);
if (codes[0] === codes[1]) throw new Error('The two teams need different codes.');
for (const s of SEQUENCES) for (const e of s.events) {
  if (!codes.includes(e.team)) throw new Error(`Sequence '${s.id}' uses team '${e.team}', which is not in the teams list.`);
}

/** 0 for the home team, 1 for the away team. */
export const teamIndex = (code: Team): 0 | 1 => (code === TEAMS[1].code ? 1 : 0);
export const teamInfo = (code: Team): TeamInfo => TEAMS[teamIndex(code)];
export const hex = (css: string): number => parseInt(css.replace('#', ''), 16);

/** Home team attacks the left goal unless the dataset says otherwise. */
const DEFAULT_ATTACK: Record<Team, Side> = DATA.attack ?? { [TEAMS[0].code]: 'left', [TEAMS[1].code]: 'right' };
export const attackOf = (seq: Sequence): Record<Team, Side> => seq.attack ?? DEFAULT_ATTACK;
for (const s of SEQUENCES) {
  const a = attackOf(s);
  if (!a[codes[0]] || !a[codes[1]] || a[codes[0]] === a[codes[1]]) {
    throw new Error(`Sequence '${s.id}': the two teams must attack opposite goals.`);
  }
}
const hasGoal = SEQUENCES.map((s) => s.events.some((e) => e.outcome === 'goal'));
export const OPEN_INDEX = Math.max(0, DATA.open
  ? SEQUENCES.findIndex((s) => s.id === DATA.open)
  : hasGoal.lastIndexOf(true));

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
