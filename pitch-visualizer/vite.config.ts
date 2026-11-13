import { existsSync, readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * MATCH=<slug> builds another match from matches/<slug>.json with the same page:
 * the dataset block and the <title> in index.html are swapped at build time.
 * Without MATCH the page is the reference build embedded in index.html.
 */
function matchDataset(): Plugin {
  const slug = process.env.MATCH;
  return {
    name: 'match-dataset',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!slug) return html;
        if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`MATCH must be a lower-case slug, got '${slug}'.`);
        const file = process.env.MATCH_FILE ?? `matches/${slug}.json`;
        if (!existsSync(file)) throw new Error(`No dataset at ${file}.`);
        const text = readFileSync(file, 'utf8').trim();
        const title = String(JSON.parse(text).match.title).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const block = /(<script type="application\/json" id="tracking-data">)[\s\S]*?(<\/script>)/;
        if (!block.test(html)) throw new Error('index.html has no tracking-data block.');
        return html
          .replace(block, (_m, open, close) => `${open}\n${text.replace(/<\//g, '<\\/')}\n${close}`)
          .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${title}</title>`);
      },
    },
  };
}

// `vite build --mode single` produces one standalone index.html: app code, styles,
// icons and the dataset are inlined; Three.js and OrbitControls stay as CDN imports
// resolved by the import map in index.html.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [matchDataset(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 900,
    rollupOptions: mode === 'single' ? { external: [/^three($|\/)/] } : {},
  },
}));
