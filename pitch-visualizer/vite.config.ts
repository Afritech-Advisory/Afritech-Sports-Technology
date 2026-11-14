import { existsSync, readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** The match to build: a file name in matches/ without .json. Set with MATCH=<slug>. */
const slug = process.env.MATCH ?? 'kenya-u23-v-ivory-coast-u23';

/** Puts matches/<slug>.json into the tracking-data block of index.html and sets the page title. */
function matchData(): Plugin {
  return {
    name: 'afritech-match-data',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const file = `matches/${slug}.json`;
        if (!existsSync(file)) throw new Error(`No dataset at ${file}. Set MATCH to a file name in matches/.`);
        const json = readFileSync(file, 'utf8').trim();
        const title = String(JSON.parse(json).match.title).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        return html
          .replace('<!--MATCH_TITLE-->', () => title)
          .replace('<!--MATCH_DATA-->', () => json.replace(/<\/(script)/gi, '<\\/$1'));
      },
    },
  };
}

// `vite build --mode single` produces one standalone index.html: app code, styles,
// icons and the dataset are inlined; Three.js and OrbitControls stay as CDN imports
// resolved by the import map in index.html.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [matchData(), viteSingleFile()] : [matchData()],
  build: {
    outDir: mode === 'single' ? `dist-single/${slug}` : 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: mode === 'single' ? { external: [/^three($|\/)/] } : {},
  },
}));
