// Usage: node capture.mjs <match slug> <sequence id> <out dir>
// Steps the built standalone page frame by frame (no clip needed) and saves 1080-wide stills:
// <out>/a = real-speed pass, <out>/b = slow pass with the coaching notes, <out>/info.json = clip trim.
import http from 'node:http'; import { createReadStream, existsSync, statSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let chromium; try { ({ chromium } = req('playwright')); } catch { ({ chromium } = req('/opt/node-tools/node_modules/playwright')); }
const [slug, seqId, out] = process.argv.slice(2);
const PV = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const root = path.join(PV, 'standalone');
const NM = path.join(PV, 'node_modules');
const data = JSON.parse(readFileSync(path.join(PV, 'matches', slug + '.json'), 'utf8'));
const index = data.sequences.findIndex((s) => s.id === seqId); const seq = data.sequences[index];
for (const d of ['a', 'b']) mkdirSync(path.join(out, d), { recursive: true });
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p); if (!existsSync(file) || file.endsWith('.mp4')) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': statSync(file).size }); createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 540, height: 900 }, deviceScaleFactor: 2 })).newPage();
await page.route('https://cdn.jsdelivr.net/npm/three@*/**', (r) => r.fulfill({ path: path.join(NM, 'three', r.request().url().replace(/^.*three@[^/]+\//, '')), contentType: 'text/javascript' }));
await page.goto(`http://127.0.0.1:${server.address().port}/${slug}/`, { waitUntil: 'load' });
await page.waitForSelector('#scene canvas'); await page.waitForTimeout(2500);
await page.evaluate((i) => document.querySelectorAll('#seqs button')[i].click(), index);
await page.addStyleTag({ content: `#reel-band{position:fixed;left:0;top:519px;width:540px;z-index:9999;height:137px;box-sizing:border-box;padding:14px 16px 0;background:var(--ink,#0d0f14);border-top:1px solid var(--rule,#2a2e38);overflow:hidden}
#reel-band .k{margin:0 0 6px;font:500 10.5px/1.2 "IBM Plex Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--muted,#8b90a0)}
#reel-band .v{margin:0;font-size:15.5px;line-height:1.38;color:var(--chalk,#ece8dd)}` });
await page.evaluate(() => { const b = document.createElement('div'); b.id = 'reel-band'; b.innerHTML = '<p class="k"></p><p class="v"></p>'; document.body.append(b); });
await page.evaluate(() => { window.dispatchEvent(new Event('resize')); return document.fonts.ready; }); await page.waitForTimeout(2500);
const max = Number(await page.evaluate(() => document.getElementById('scrub').max));
const band = (k, v) => page.evaluate(([k, v]) => { document.querySelector('#reel-band .k').textContent = k; document.querySelector('#reel-band .v').textContent = v; }, [k, v]);
const shot = async (f, file) => {
  await page.evaluate((f) => { const s = document.getElementById('scrub'); s.value = String(f); s.dispatchEvent(new Event('input', { bubbles: true })); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))); }, f);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 540, height: 656 } });
};
await band(`${seq.label} · ${seq.title} · real speed`, 'Match clip above. Below it, the same passage tagged on a 3D pitch, frame for frame.');
for (let f = 0; f <= max; f++) await shot(f, path.join(out, 'a', String(f).padStart(4, '0') + '.png'));
for (let f = 0; f <= max; f++) {
  const n = Math.min(2, Math.floor((f / (max + 1)) * 3));
  await band(`Slow replay · coaching note ${n + 1} of 3`, seq.notes[n]);
  await shot(f, path.join(out, 'b', String(f).padStart(4, '0') + '.png'));
}
const fps = data.clip.fps, startFrame = Math.round((seq.events[0].t - 0.4 + (seq.videoOffset ?? 0)) * fps);
writeFileSync(path.join(out, 'info.json'), JSON.stringify({ frames: max + 1, fps, startFrame, startSeconds: startFrame / fps, label: seq.label, title: seq.title }));
console.log(readFileSync(path.join(out, 'info.json'), 'utf8'));
await browser.close(); server.close();
