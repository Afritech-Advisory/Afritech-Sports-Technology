import { ArrowHelper, Vector3, type Intersection } from 'three';
import {
  createIcons, Flame, Goal, Grid3x3, Info, LayoutGrid, MousePointerClick, Pause, Play, RotateCcw,
  StepBack, StepForward, Tag, Upload, Video, Volume2, VolumeX, X,
} from 'lucide';
import { SceneManager, type ViewName } from './core/SceneManager';
import { Picker } from './core/Picker';
import { Narrator } from './ui/Narrator';
import { Pitch } from './pitch/Pitch';
import { PITCH, toWorld } from './pitch/dimensions';
import { ThreatSurface } from './viz/ThreatSurface';
import { EventLayer, type EventLabel } from './viz/EventLayer';
import {
  CLIP, EVENT_META, MATCH, SEQUENCES, clock, deltaXT, eventDuration, pressureLevel, shotXG, zoneName,
  type Team,
} from './data/match';
import { xT } from './data/models';
import './style.css';

const ICONS = {
  Flame, Goal, Grid3x3, Info, LayoutGrid, MousePointerClick, Pause, Play, RotateCcw, StepBack, StepForward, Tag, Upload, Video, Volume2, VolumeX, X,
};
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

const scrub = $<HTMLInputElement>('scrub');

// ---- State -----------------------------------------------------------------
type ThreatMode = Team | 'off';
const state = {
  seq: 0, t: 0, playing: false, speed: 1, active: -1,
  selected: null as { index: number; at: Vector3 } | null,
  threat: 'KEN' as ThreatMode, threatAuto: true, labels: true,
};
const seq = () => SEQUENCES[state.seq];
const seqStart = () => seq().events[0].t - 0.4;
const frameCount = () => Math.round((seq().end - seqStart()) * CLIP.fps);
const clipFrame = () => Math.round((state.t + seq().videoOffset) * CLIP.fps);
const attackingTeam = (): Team => seq().events.find((e) => e.type === 'shot')?.team ?? seq().events[0].team;

function setThreat(mode: ThreatMode): void {
  state.threat = mode;
  threat.mesh.visible = mode !== 'off';
  if (mode !== 'off') threat.setTeam(mode);
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
  select(null);
  narrator.load(`${SEQUENCES[i].label} ${SEQUENCES[i].title}.`, SEQUENCES[i].notes);
  layer.load(seq());
  scrub.max = String(frameCount());
  const span = seq().end - seqStart();
  $('ticks').innerHTML = seq().events.map((e) =>
    `<i class="${e.team.toLowerCase()}${e.outcome === 'goal' ? ' goal' : ''}" style="left:${(((e.t - seqStart()) / span) * 100).toFixed(2)}%"></i>`).join('');
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

  renderNotes();

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

const p = { x: 0, y: 0, visible: false };

// ---- Controls ----------------------------------------------------------------
$('seqs').innerHTML = SEQUENCES.map((s, i) =>
  `<button data-i="${i}"><span class="seq-min">${s.label}</span><span class="seq-title">${s.title}</span></button>`).join('');
$('seqs').addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest('button');
  if (!b) return;
  loadSequence(Number(b.dataset.i), false);
  setPlaying(true);
  narrator.play(true);
});
$('events').addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest('button');
  if (!b) return;
  const i = Number(b.dataset.i);
  setPlaying(false);
  narrator.stop();
  state.t = Math.min(seq().end, seq().events[i].t + eventDuration(seq(), i));
});
$('play').addEventListener('click', () => {
  if (state.playing) {
    setPlaying(false);
    narrator.stop();
    return;
  }
  if (state.t >= seq().end - 0.01) state.t = seqStart();
  const fromTop = state.t <= seqStart() + 0.5;
  setPlaying(true);
  narrator.play(fromTop);
});
$('restart').addEventListener('click', () => { state.t = seqStart(); setPlaying(true); narrator.stop(); narrator.play(true); });
scrub.addEventListener('input', () => {
  setPlaying(false);
  narrator.stop();
  state.t = seqStart() + Number(scrub.value) / CLIP.fps;
});
function step(frames: number): void {
  setPlaying(false);
  narrator.stop();
  state.t = Math.max(seqStart(), Math.min(seq().end, state.t + frames / CLIP.fps));
}
$('step-back').addEventListener('click', () => step(-1));
$('step-fwd').addEventListener('click', () => step(1));
window.addEventListener('keydown', (ev) => {
  const el = ev.target as HTMLElement;
  if (el.closest('input, button, summary')) return;
  if (ev.key === ' ') { ev.preventDefault(); $('play').click(); }
  if (ev.key === 'ArrowLeft') step(ev.shiftKey ? -10 : -1);
  if (ev.key === 'ArrowRight') step(ev.shiftKey ? 10 : 1);
  if (ev.key === 'Escape') select(null);
});

// ---- Sidebar tabs, coaching notes, clip slot ------------------------------------
const TABS = ['events', 'notes', 'clip'];
for (const name of TABS) {
  $(`tab-${name}`).addEventListener('click', () => {
    for (const other of TABS) {
      $(`tab-${other}`).setAttribute('aria-selected', String(other === name));
      $(`pane-${other}`).hidden = other !== name;
    }
  });
}

// ---- Coaching notes read aloud on Play ---------------------------------------
const caption = $('caption');
const narrator = new Narrator((index, text) => {
  caption.hidden = !text;
  caption.textContent = text;
  document.querySelectorAll<HTMLElement>('#notes li').forEach((li, j) =>
    li.classList.toggle('speaking', j === index));
});
const voiceBtn = $('voice');
function setVoice(on: boolean): void {
  narrator.setEnabled(on);
  voiceBtn.setAttribute('aria-pressed', String(on));
  voiceBtn.setAttribute('aria-label', on ? 'Voice notes on' : 'Voice notes off');
  voiceBtn.innerHTML = `<i data-lucide="${on ? 'volume-2' : 'volume-x'}"></i>`;
  icons();
  try { localStorage.setItem('pitch-voice', on ? '1' : '0'); } catch { /* storage unavailable */ }
  if (on && state.playing) narrator.play(false);
}
/** Tell the viewer which voice their device is using; voices can load after the page. */
function describeVoice(): void {
  const d = narrator.describeVoice();
  if (!d) return;
  $('voice-help').textContent = d.african
    ? `Read aloud in a ${d.label} voice when you press Play.`
    : `Read aloud when you press Play. This device has no Kenyan or other African English voice, so it is using ${d.label}. Microsoft Edge on a computer includes Kenyan English voices.`;
}
if (narrator.supported) {
  describeVoice();
  speechSynthesis.addEventListener?.('voiceschanged', describeVoice);
  let saved = '1';
  try { saved = localStorage.getItem('pitch-voice') ?? '1'; } catch { /* storage unavailable */ }
  setVoice(saved !== '0');
  voiceBtn.addEventListener('click', () => setVoice(!narrator.enabled));
} else {
  voiceBtn.hidden = true;
  $('voice-help').textContent = 'This browser cannot read the notes aloud.';
}

const coach = $<HTMLTextAreaElement>('coach-notes');
const noteKey = () => `pitch-notes:${seq().id}`;
function renderNotes(): void {
  $('notes').innerHTML = seq().notes.map((n) =>
    `<li class="border-l-2 border-[var(--arc)] pl-3">${n}</li>`).join('');
  let saved = '';
  try { saved = localStorage.getItem(noteKey()) ?? ''; } catch { /* storage unavailable */ }
  coach.value = saved;
}
coach.addEventListener('input', () => {
  let ok = true;
  try { localStorage.setItem(noteKey(), coach.value); } catch { ok = false; }
  $('notes-status').textContent = ok
    ? 'Saved in this browser only. Not shared with other viewers.'
    : 'This browser is not allowing saved notes. Copy your text before closing.';
});

const video = $<HTMLVideoElement>('clip');
let clipLoaded = false;
const clipStatus = (text: string) => { $('clip-status').textContent = text; };

/** Attach a clip source; report whether it plays and whether its length matches the tags. */
function useClip(src: string, name: string, onFail: () => void): void {
  clipLoaded = false;
  const ok = () => {
    video.removeEventListener('error', bad);
    clipLoaded = true;
    $('clip-empty').hidden = true;
    const expected = CLIP.frames / CLIP.fps;
    clipStatus(Math.abs(video.duration - expected) < 2
      ? `${name} loaded. It follows the timeline.`
      : `${name} loaded, but it runs ${Math.round(video.duration)} s and the tags were made on a ${Math.round(expected)} s clip, so it will not line up.`);
    syncClip();
  };
  const bad = () => { video.removeEventListener('loadedmetadata', ok); onFail(); };
  video.addEventListener('loadedmetadata', ok, { once: true });
  video.addEventListener('error', bad, { once: true });
  video.src = src;
}

$<HTMLInputElement>('clip-file').addEventListener('change', (ev) => {
  const file = (ev.target as HTMLInputElement).files?.[0];
  if (!file) return;
  useClip(URL.createObjectURL(file), file.name,
    () => clipStatus('That file could not be played here. Try an MP4 (H.264).'));
});

// Published with the page (GitHub Pages): fetch the clip from its own URL next to index.html.
// Anywhere it is missing (a downloaded copy, an embed), the device picker stays as the fallback.
if (CLIP.src && location.protocol.startsWith('http')) {
  clipStatus('Loading the match clip…');
  useClip(new URL(CLIP.src, location.href).href, 'Match clip', () => {
    video.removeAttribute('src'); video.load();
    clipStatus('The match clip is not online with this copy of the page. Load it from your device and it plays in step with the timeline, frame for frame.');
  });
}

/** Keep the clip on the same frame as the timeline. */
function syncClip(): void {
  if (!clipLoaded) return;
  const target = Math.max(0, state.t + seq().videoOffset);
  if (state.playing) {
    video.playbackRate = state.speed;
    if (video.paused) { video.currentTime = target; void video.play().catch(() => {}); }
    else if (Math.abs(video.currentTime - target) > 0.35) video.currentTime = target;
  } else {
    if (!video.paused) video.pause();
    if (Math.abs(video.currentTime - target) > 1 / CLIP.fps) video.currentTime = target;
  }
}

// ---- Click to inspect -----------------------------------------------------------
const card = $('card');
const m1 = (v: number) => v.toFixed(1);
function select(hit: { index: number; at: Vector3 } | null): void {
  state.selected = hit;
  layer.select(hit ? hit.index : null);
  card.hidden = !hit;
  if (!hit) return;
  const e = seq().events[hit.index];
  const from = `${m1(e.from[0])}, ${m1(e.from[1])} m · zone ${zoneName(e.from[0], e.from[1])}`;
  const rows: [string, string][] = [['Start', from]];
  if (e.to) {
    rows.push(['End', `${m1(e.to[0])}, ${m1(e.to[1])} m · zone ${zoneName(e.to[0], e.to[1])}`]);
    rows.push(['Distance', `${m1(Math.hypot(e.to[0] - e.from[0], e.to[1] - e.from[1]))} m`]);
  }
  const g = shotXG(e), d = deltaXT(e);
  if (g !== null) rows.push(['Shot quality', `${g.toFixed(2)} xG`]);
  else if (e.to) {
    const a = xT(e.from[0], e.from[1], e.team), b = xT(e.to[0], e.to[1], e.team);
    rows.push(['Threat', `${a.toFixed(3)} → ${b.toFixed(3)}${d !== null ? ` (${signed(d)})` : ', not credited'}`]);
  } else rows.push(['Threat here', `${xT(e.from[0], e.from[1], e.team).toFixed(3)} xT`]);
  const px = hit.at.x + PITCH.length / 2, py = PITCH.width / 2 - hit.at.z;
  rows.push(['Clicked point', `${m1(px)}, ${m1(py)} m${hit.at.y > 0.9 ? ` · ${m1(hit.at.y)} m up` : ''}`]);
  rows.push(['Clip frame', `${Math.round((e.t + seq().videoOffset) * CLIP.fps).toLocaleString('en')}`]);
  const pr = e.pressure;
  const level = pr ? pressureLevel(pr) : null;
  card.innerHTML = `
    <header><span class="ev-clock">${clock(e.t)}</span>
      <span class="${e.team.toLowerCase()}"><span class="dot"></span>${TEAM_NAME[e.team]}</span>
      <button class="card-close" id="card-close" aria-label="Close"><i data-lucide="x"></i></button></header>
    <h2>${EVENT_META[e.type].label}${e.player ? `, No. ${e.player}` : ''}${e.outcome === 'goal' ? ' · Goal' : ''}</h2>
    <dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <div class="pressure ${level ?? 'none'}">
      <p class="p-head">Pressure on the ball${level ? `<b>${level}</b>` : ''}</p>
      <p>${pr
        ? `${pr.within5} opponent${pr.within5 === 1 ? '' : 's'} within 5 m, nearest about ${pr.nearest} m. Read from the broadcast frame.`
        : 'The surrounding players are out of shot at this moment. The ring marks the 5 m zone around the ball.'}</p>
    </div>`;
  icons();
  $('card-close').addEventListener('click', () => select(null));
  document.querySelectorAll<HTMLElement>('#events button').forEach((b, j) =>
    b.classList.toggle('picked', j === hit.index));
}
new Picker(sm, () => layer.pickTargets(), (hit: Intersection | null) => {
  const index = hit?.object.userData.eventIndex as number | undefined;
  const snap = hit?.object.userData.snap as Vector3 | undefined; // player marks report the player's own position
  select(hit && index !== undefined ? { index, at: (snap ?? hit.point).clone() } : null);
});
const view = $('view');
function placeCard(): void {
  if (!state.selected) return;
  sm.project(state.selected.at, p);
  const x = Math.max(8, Math.min(view.clientWidth - card.offsetWidth - 8, p.x + 18));
  const y = Math.max(8, Math.min(view.clientHeight - card.offsetHeight - 8, p.y - card.offsetHeight - 14));
  card.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
}
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
  <div><dt>Match</dt><dd>${MATCH.competition}. ${MATCH.home} ${MATCH.result} ${MATCH.away}.</dd></div>
  <div><dt>Footage</dt><dd>${MATCH.footage.kind}, ${MATCH.window}. ${MATCH.footage.rights}</dd></div>
  <div><dt>Data</dt><dd>We tagged ${SEQUENCES.reduce((n, s) => n + s.events.length, 0)} events across ${SEQUENCES.length} sequences on a 105 × 68 m pitch. ${MATCH.footage.method} Players are identified by shirt number.</dd></div>
  <div><dt>Threat and xG</dt><dd>The threat surface shows how likely possession in each area is to lead to a goal, rising toward the penalty box, and lifts where the selected team built threat in the sequence on screen. Shot quality (xG) comes from shot distance and goal angle.</dd></div>
  <div><dt>Next</dt><dd>Full-match footage lets us extend this to every possession and every player on the pitch.</dd></div>`;

// ---- Frame loop -----------------------------------------------------------------
/**
 * Intensity points for the shader: where the selected team moved or struck the ball
 * in this sequence, weighted by the threat gained, fading in as playback reaches them.
 */
const context: number[] = [];
function contextPoints(): number[] {
  context.length = 0;
  if (state.threat === 'off') return context;
  seq().events.forEach((e, i) => {
    if (e.team !== state.threat) return;
    const k = Math.max(0, Math.min(1, (state.t - e.t) / eventDuration(seq(), i)));
    if (k <= 0) return;
    const g = shotXG(e), d = deltaXT(e);
    const weight = g !== null ? 0.35 + g
      : d !== null ? 0.12 + Math.max(0, d) * 4
      : e.outcome === 'won' ? 0.15 : 0.05;
    const at = e.to && e.outcome !== 'incomplete' && e.outcome !== 'lost' && g === null ? e.to : e.from;
    context.push(at[0], at[1], Math.min(1, weight) * k);
  });
  return context;
}
const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  const active = layer.update(state.t, elapsed, sm.camera);
  threat.setPoints(contextPoints());
  if (!still) threat.setTime(elapsed);
  if (active !== state.active) showActive(active);
  updateScore();

  const f = String(Math.round((state.t - seqStart()) * CLIP.fps));
  if (scrub.value !== f) scrub.value = f;
  const label = clock(Math.floor(Math.max(state.t, seq().events[0].t)));
  if ($('clock').textContent !== label) $('clock').textContent = label;
  const frame = `frame ${clipFrame().toLocaleString('en')}`;
  if ($('frame').textContent !== frame) $('frame').textContent = frame;
  if (state.selected && state.t < seq().events[state.selected.index].t) select(null);
  placeCard();
  syncClip();

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
