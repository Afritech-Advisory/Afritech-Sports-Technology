// Builds one standalone page per match.
//   node scripts/build-single.mjs                 every dataset in matches/
//   node scripts/build-single.mjs <slug> [...]    only the named ones
// Output for each match:
//   dist-single/<slug>/index.html      the standalone page
//   dist-single/<slug>/artifact.html   the same page without the document wrapper, for the preview
//   standalone/...                     the published copy (GitHub Pages serves standalone/)
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

/** The first match keeps the site root; every other match is published at /<slug>/. */
const ROOT_MATCH = 'kenya-u23-v-ivory-coast-u23';

const all = readdirSync('matches').filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const wanted = process.argv.slice(2);
for (const slug of wanted) if (!all.includes(slug)) throw new Error(`No dataset at matches/${slug}.json`);

for (const slug of wanted.length ? wanted : all) {
  execFileSync('npx', ['vite', 'build', '--mode', 'single'], { stdio: 'inherit', env: { ...process.env, MATCH: slug } });
  const html = readFileSync(`dist-single/${slug}/index.html`, 'utf8');

  const dir = slug === ROOT_MATCH ? 'standalone' : `standalone/${slug}`;
  mkdirSync(dir, { recursive: true });
  copyFileSync(`dist-single/${slug}/index.html`, `${dir}/index.html`);

  // Strip the document wrapper so the page can be published as a self-contained fragment
  const out = html
    .replace(/<!doctype html>/i, '')
    .replace(/<\/?(html|head|body)[^>]*>/gi, '')
    .replace(/<meta charset[^>]*>/i, '')
    .replace(/<meta name="viewport"[^>]*>/i, '');
  writeFileSync(`dist-single/${slug}/artifact.html`, out.trim() + '\n');
  console.log(`${dir}/index.html`, (html.length / 1024).toFixed(0) + ' KB', '| artifact', (out.length / 1024).toFixed(0) + ' KB');
}
