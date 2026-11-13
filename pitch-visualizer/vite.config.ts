import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build --mode single` produces one standalone index.html: app code, styles,
// icons and the dataset are inlined; Three.js and OrbitControls stay as CDN imports
// resolved by the import map in index.html.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 900,
    rollupOptions: mode === 'single' ? { external: [/^three($|\/)/] } : {},
  },
}));
