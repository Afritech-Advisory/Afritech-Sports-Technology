import { ArrowHelper, Vector3 } from 'three';
import {
  createIcons, Flame, Goal, Grid3x3, Info, LayoutGrid, Move3d, Pause, Play, RotateCcw, Tag, Video,
} from 'lucide';
import { SceneManager, type ViewName } from './core/SceneManager';
import { Pitch } from './pitch/Pitch';
import { PITCH, toWorld } from './pitch/dimensions';
import { ThreatSurface } from './viz/ThreatSurface';
import { EventLayer, type EventLabel } from './viz/EventLayer';
import {
  EVENT_META, MATCH, SEQUENCES, clock, deltaXT, eventDuration, shotXG, type Team,
} from './data/match';
import './style.css';

const ICONS = { Flame, Goal, Grid3x3, Info, LayoutGrid, Move3d, Pause, Play, RotateCcw, Tag, Video };
const TEAM_NAME: Record<Team, string> = { KEN: 'Kenya', CIV: 'Ivory Coast' };
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const signed = (v: number) => `${Math.abs(v) < 0.0005 ? '' : v > 0 ? '+' : '−'}${Math.abs(v).toFixed(3)}`;

// ---- Scene ----------------------------------------------------------------
const sm = new SceneManager($('scene'));
const pitch = new Pitch();
const threat = new ThreatSurface();
const layer = new EventLayer();
sm.scene.add(pitch.group, threat.mesh, layer.group);

// Axis gizmo at the near-left corner of the slab, in pitch coordinates
const origin = new Vector3(-PITCH.length / 2 - PITCH.apron, 0.1, PITCH.width / 2 + PITCH.apron);
const axes: [Vector3, string][] = [
  [new Vector3(1, 0, 0), 'x'], [new Vector3(0, 0, -1), 'y'], [new Vector3(0, 1, 0), 'z'],
];
for (const [dir] of axes) sm.scene.add(new ArrowHelper(dir, origin, 9, 0xece8dc, 2, 1));

// ---- Annotations drawn over the canvas -------------------------------------
const labelRoot = $('labels');
interface Note { el: HTMLElement; at: Vector3 }
const notes: Note[] = [];
function note(text: string, at: Vector3, cls = 'note'): void {
  const el = document.createElement('span');
  el.className = cls;
  el.textContent = text;
  labelRoot.appendChild(el);
  notes.push({ el, at });
}
for (const [dir, name] of axes) note(name, origin.clone().addScaledVector(dir, 11.5));
note('105 m', new Vector3(0, 0, PITCH.width / 2 + PITCH.apron + 2.5));
note('68 m', new Vector3(PITCH.length / 2 + PITCH.apron + 3, 0, 19));
note('Ivory Coast goal', toWorld(-7, 34, 5), 'note goal-note');
note('Kenya goal', toWorld(112, 34, 5), 'note goal-note');

const valuePool: HTMLElement[] = [];
function valueEl(i: number): HTMLElement {
  while (valuePool.length <= i) {
    const el = document.createElement('span');
    labelRoot.appendChild(el);
    valuePool.push(el);
  }
  return valuePool[i];
}

// ---- State -----------------------------------------------------------------
type ThreatMode = Team | 'off';
const state = {
  seq: 0, t: 0, playing: false, speed: 1, active: -1,
  threat: 'KEN' as ThreatMode, threatAuto: true, labels: true,
};
const seq = () => SEQUENCES[state.seq];
const seqStart = () => seq().events[0].t - 0.4;
const attackingTeam = (): Team => seq().events.find((e) => e.type === 'shot')?.team ?? seq().events[0].team;

function setThreat(mode: ThreatMode): void {
  state.threat = mode;
  threat.mesh.visible = mode !== 'off';
  if (mode !== 'off') threat.paint(mode);
  $('threat-label').textContent = mode === 'off' ? 'Threat: off' : `Threat: ${TEAM_NAME[mode]}`;
}

function icons(): void {
  createIcons({ icons: ICONS, attrs: { 'aria-hidden': 'true' } });
}

function setPlaying(on: boolean): void {
  state.playing = on;
  const btn = $('play');
  btn.setAttribute('aria-label', on ? 'Pause' : 'Play');
  btn.innerHTML = `<i data-lucide="${on ? 'pause' : 'play'}"></i>`;
  icons();
}

function loadSequence(i: number, atEnd: boolean): void {
  state.seq = i;
  state.active = -1;
  layer.load(seq());
  state.t = atEnd ? seq().end : seqStart();
  if (state.threatAuto) setThreat(attackingTeam());

  document.querySelectorAll<HTMLElement>('#seqs button').forEach((b, j) =>
    b.setAttribute('aria-current', String(j === i)));

  const team = attackingTeam();
  const added = seq().events.reduce((s, e) => s + (e.team === team ? deltaXT(e) ?? 0 : 0), 0);
  const xg = seq().events.reduce((s, e) => s + (shotXG(e) ?? 0), 0);
  $('totals').innerHTML = `
    <div><dt>Threat added, ${TEAM_NAME[team]}</dt><dd>${signed(added)} xT</dd></div>
    <div><dt>Shot quality</dt><dd>${xg > 0 ? xg.toFixed(2) + ' xG' : 'No shot'}</dd></div>
    <div><dt>Tagged events</dt><dd>${seq().events.length}</dd></div>`;

  $('events').innerHTML = seq().events.map((e, j) => {
    const dxt = deltaXT(e), g = shotXG(e);
    const val = g !== null ? `xG ${g.toFixed(2)}` : dxt !== null ? signed(dxt) : '';
    const who = e.player ? ` <em>No. ${e.player}</em>` : '';
    const tail = e.outcome === 'goal' ? ' <b>Goal</b>' : e.outcome === 'incomplete' ? ' <em>incomplete</em>' : '';
    return `<li><button data-i="${j}" class="${e.team.toLowerCase()}">
      <span class="ev-clock">${clock(e.t)}</span><span class="dot"></span>
      <span class="ev-what">${EVENT_META[e.type].label}${who}${tail}</span>
      <span class="ev-val">${val}</span></button></li>`;
  }).join('');
}

function showActive(i: number): void {
  state.active = i;
  const e = seq().events[i];
  document.querySelectorAll<HTMLElement>('#events button').forEach((b, j) => {
    b.setAttribute('aria-current', String(j === i));
    if (j === i && state.playing) b.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  $('now').innerHTML = `
    <p class="now-head"><span class="ev-clock">${clock(e.t)}</span>
      <span class="${e.team.toLowerCase()}"><span class="dot"></span>${TEAM_NAME[e.team]}</span></p>
    <p class="now-what">${EVENT_META[e.type].label}${e.player ? `, No. ${e.player}` : ''}${e.outcome === 'goal' ? ' · Goal' : ''}</p>
    ${e.note ? `<p class="now-note">${e.note}</p>` : ''}
    <p class="now-opta">${EVENT_META[e.type].opta}</p>`;
}

function updateScore(): void {
  let ken = 0, civ = 0;
  for (const s of SEQUENCES) for (const e of s.events) {
    if (e.outcome === 'goal' && e.t + 1.4 <= state.t) e.team === 'KEN' ? ken++ : civ++;
  }
  $('score').textContent = `${ken}–${civ}`;
}

// ---- Controls ----------------------------------------------------------------
$('seqs').innerHTML = SEQUENCES.map((s, i) =>
  `<button data-i="${i}"><span class="seq-min">${s.label}</span><span class="seq-title">${s.title}</span></button>`).join('');
$('seqs').addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest('button');
  if (!b) return;
  loadSequence(Number(b.dataset.i), false);
  setPlaying(true);
});
$('events').addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest('button');
  if (!b) return;
  const i = Number(b.dataset.i);
  setPlaying(false);
  state.t = Math.min(seq().end, seq().events[i].t + eventDuration(seq(), i));
});
$('play').addEventListener('click', () => {
  if (!state.playing && state.t >= seq().end - 0.01) state.t = seqStart();
  setPlaying(!state.playing);
});
$('restart').addEventListener('click', () => { state.t = seqStart(); setPlaying(true); });
const scrub = $<HTMLInputElement>('scrub');
scrub.addEventListener('input', () => {
  setPlaying(false);
  state.t = seqStart() + (Number(scrub.value) / 1000) * (seq().end - seqStart());
});
$('speed').addEventListener('click', () => {
  state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 0.5 : 1;
  $('speed').textContent = `${state.speed === 0.5 ? '½' : state.speed}×`;
});
$('threat').addEventListener('click', () => {
  state.threatAuto = false;
  setThreat(state.threat === 'KEN' ? 'CIV' : state.threat === 'CIV' ? 'off' : 'KEN');
});
$('toggle-labels').addEventListener('click', (ev) => {
  state.labels = !state.labels;
  (ev.currentTarget as HTMLElement).setAttribute('aria-pressed', String(state.labels));
});
$('toggle-grid').addEventListener('click', (ev) => {
  pitch.zoneGrid.visible = !pitch.zoneGrid.visible;
  (ev.currentTarget as HTMLElement).setAttribute('aria-pressed', String(pitch.zoneGrid.visible));
});
document.querySelectorAll<HTMLElement>('[data-view]').forEach((b) =>
  b.addEventListener('click', () => {
    sm.setView(b.dataset.view as ViewName);
    document.querySelectorAll('[data-view]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  }));
sm.controls.addEventListener('start', () => document.querySelector('.hint')?.classList.add('gone'));

$('source').innerHTML = `
  <div><dt>Footage</dt><dd>${MATCH.footage.kind}. ${MATCH.window}.</dd></div>
  <div><dt>Rights</dt><dd>${MATCH.footage.rights}</dd></div>
  <div><dt>Positions</dt><dd>${MATCH.footage.method} Players are listed by shirt number only and need reconciling with the match sheet.</dd></div>
  <div><dt>Models</dt><dd>The threat surface is a generic approximation, not fitted to this competition. xG uses shot distance and goal angle only.</dd></div>`;

// ---- Frame loop -----------------------------------------------------------------
const p = { x: 0, y: 0, visible: false };
function place(el: HTMLElement, at: Vector3, show: boolean): void {
  sm.project(at, p);
  const on = show && p.visible;
  el.hidden = !on;
  if (on) el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%)`;
}

sm.onFrame((dt, elapsed) => {
  if (state.playing) {
    state.t += dt * state.speed;
    if (state.t >= seq().end) { state.t = seq().end; setPlaying(false); }
  }
  const active = layer.update(state.t, elapsed);
  if (active !== state.active) showActive(active);
  updateScore();

  scrub.value = String(Math.round(((state.t - seqStart()) / (seq().end - seqStart())) * 1000));
  $('clock').textContent = clock(Math.floor(Math.max(state.t, seq().events[0].t)));

  for (const n of notes) place(n.el, n.at, true);
  layer.labels.forEach((l: EventLabel, i) => {
    const el = valueEl(i);
    el.className = `value ${l.kind} ${l.event.team.toLowerCase()}`;
    if (el.textContent !== l.text) el.textContent = l.text;
    place(el, l.anchor, state.labels && l.reveal > 0.55);
  });
  for (let i = layer.labels.length; i < valuePool.length; i++) valuePool[i].hidden = true;
});

// Open on the winning goal, fully drawn, so the page reads at rest.
icons();
loadSequence(3, true);
sm.start();
