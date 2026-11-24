// Capture a live page in phone layout (480 css px wide, 2x = 960 px) for the video.
// Usage: node capture.js <url> [sectionId ...]
// Writes cap/hero.png (top of page) and cap/<id>.png per section (max 2300 css px tall each).
const { chromium } = require('playwright');
(async () => {
  const [url, ...ids] = process.argv.slice(2);
  require('fs').mkdirSync('cap', { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 480, height: 1400 }, deviceScaleFactor: 2 });
  await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: 'cap/hero.png' });
  // slow scroll once so reveal-on-scroll sections render
  const H = await p.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < H; y += 600) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(60); }
  for (const id of ids) {
    const top = await p.evaluate(id => { const e = document.getElementById(id); return e ? e.getBoundingClientRect().top + scrollY : null; }, id);
    if (top === null) { console.log('missing section', id); continue; }
    const tall = await p.evaluate(id => document.getElementById(id).offsetHeight, id);
    // hide sticky headers so they don't repeat inside every capture
    await p.evaluate(() => document.querySelectorAll('header,.sticky,[style*="sticky"]').forEach(e => e.style.visibility = 'hidden'));
    await p.screenshot({ path: `cap/${id}.png`, fullPage: true, clip: { x: 0, y: top, width: 480, height: Math.min(tall, 2300) } });
    await p.evaluate(() => document.querySelectorAll('header,.sticky,[style*="sticky"]').forEach(e => e.style.visibility = ''));
    console.log('captured', id, Math.min(tall, 2300));
  }
  // section list for reference
  console.log('ids on page:', await p.evaluate(() => [...document.querySelectorAll('section[id],div[id]')].map(e => e.id).filter(Boolean).slice(0, 40).join(' ')));
  await b.close();
})();
