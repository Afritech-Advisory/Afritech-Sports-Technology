// Reel v2, step 2: capture the 3D pitch frames for each passage in plan.json (see plan.py).
//
//   node scripts/reel/capture.mjs <match slug> <work dir> [seq id ...]
//
// Opens the built page in ?reel=1 mode (no header, sidebar, timeline or buttons) at 540 x 281 CSS px,
// deviceScaleFactor 2, so frames are 1080 x 562: the 3D panel under the caption band.
// <work>/<id>/a/%05d.png  real speed, 30 fps, opening camera
// <work>/<id>/b/%05d.png  replay at one-third speed (t advances 1/90 s a frame), then held on the last
//                          moment while the voice finishes; the camera pushes slowly toward the shot
//                          and each coaching note lights up its ball path (layer.highlight).
// Each passage runs in its own browser, so passages capture in parallel.
import http from 'node:http'; import { copyFileSync, createReadStream, existsSync, readdirSync, statSync, mkdirSync, readFileSync } from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let chromium; try { ({ chromium } = req('playwright')); } catch { ({ chromium } = req('/opt/node-tools/node_modules/playwright')); }
const [slug, work, ...only] = process.argv.slice(2);
const PV = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const root = path.join(PV, 'standalone');
const NM = path.join(PV, 'node_modules');
const plan = JSON.parse(readFileSync(path.join(work, 'plan.json'), 'utf8'));
const data = JSON.parse(readFileSync(path.join(PV, 'matches', slug + '.json'), 'utf8'));

const server = http.createServer((q, res) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p); if (!existsSync(file) || file.endsWith('.mp4')) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': statSync(file).size }); createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));

/** Which event each coaching note points at: note n -> event n, the last note -> the shot. */
function noteEvent(seq, n) {
  const shot = seq.events.findIndex((e) => e.type === 'shot');
  if (n === seq.notes.length - 1 && shot >= 0) return shot;
  return Math.min(n, seq.events.length - 1);
}

async function capture(seg) {
  const index = data.sequences.findIndex((s) => s.id === seg.id); const seq = data.sequences[index];
  const out = path.join(work, seg.id);
  for (const d of ['a', 'b']) mkdirSync(path.join(out, d), { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 540, height: plan.viewH / 2 }, deviceScaleFactor: 2 })).newPage();
  page.on('pageerror', (e) => console.error(seg.id, 'page error:', String(e)));
  await page.route('https://cdn.jsdelivr.net/npm/three@*/**', (r) => r.fulfill({ path: path.join(NM, 'three', r.request().url().replace(/^.*three@[^/]+\//, '')), contentType: 'text/javascript' }));
  await page.goto(`http://127.0.0.1:${server.address().port}/${slug}/?reel=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.reel && document.querySelector('#scene canvas'));
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1500);
  await page.evaluate((i) => window.reel.load(i), index);
  await page.waitForTimeout(800);
  const shot = async (set, file) => {
    await page.evaluate(async (s) => {
      window.reel.set(s.t);
      window.reel.highlight(s.h ?? null);
      window.reel.camera(s.k, s.at);
      await window.reel.frame();
    }, set);
    await page.screenshot({ path: file });
  };
  const nA = Math.round(seg.D * plan.fps);
  const have = (d) => (existsSync(d) ? readdirSync(d).length : 0);
  if (have(path.join(out, 'a')) !== nA) {
    for (let j = 0; j < nA; j++) await shot({ t: seg.start + j / plan.fps, k: 0, at: seg.shotAt }, path.join(out, 'a', String(j).padStart(5, '0') + '.png'));
  }
  if (seg.replay) {
    // Voice-led replay (beats.py): one state per output frame; identical states (freeze-frames) are copied.
    const dir = path.join(out, 'r'); mkdirSync(dir, { recursive: true });
    let prev = null, prevFile = null;
    for (const [j, f] of seg.replay.frames.entries()) {
      const file = path.join(dir, String(j).padStart(5, '0') + '.png');
      const key = `${f.T}|${f.k}|${f.hl.join(',')}`;
      if (key === prev) copyFileSync(prevFile, file);
      else await shot({ t: f.T, k: f.k, at: seg.shotAt, h: f.hl }, file);
      prev = key; prevFile = file;
      if (j % 300 === 0) console.log(seg.id, 'replay', j, '/', seg.replay.frames.length);
    }
  } else {
    const nB = Math.round(seg.L * plan.fps);
    for (let j = 0; j < nB; j++) {
      const x = j / plan.fps; // seconds into the replay
      const v = [...seg.voice].reverse().find((n) => x >= n.at);
      await shot({ t: seg.start + Math.min(x / 3, seg.D), k: j / (nB - 1), at: seg.shotAt, h: v ? noteEvent(seq, v.note) : null },
        path.join(out, 'b', String(j).padStart(5, '0') + '.png'));
      if (j % 300 === 0) console.log(seg.id, 'replay', j, '/', nB);
    }
  }
  await browser.close();
  console.log(seg.id, 'done');
}

await Promise.all(plan.segments.filter((s) => !only.length || only.includes(s.id)).map(capture));
server.close();
