import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fyldoCssScope } from './tools/vite/css-scope.ts';
import { fyldoStatic } from './tools/vite/static.ts';

/** Test-only build: renders single component variants for the Figma parity tests. Never shipped. */
export default defineConfig({
  root: fileURLToPath(new URL('./tests/harness/gallery', import.meta.url)),
  plugins: [tailwindcss(), fyldoCssScope({ root: '[data-fyldo-v1]' }), fyldoStatic()],
  resolve: { alias: { '@': fileURLToPath(new URL('./app', import.meta.url)) } },
  build: {
    outDir: fileURLToPath(new URL('./e2e/.generated/gallery', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    modulePreload: false,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
      input: { main: fileURLToPath(new URL('./tests/harness/gallery/main.tsx', import.meta.url)) },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js', // as in the real build: the icon loader finds `icons/` from a chunk too
        assetFileNames: (info) => (info.names?.some((n) => n.endsWith('.css')) ? 'app.css' : 'assets/[name]-[hash][extname]'),
      },
    },
  },
});
