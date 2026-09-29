import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { fyldoCssScope } from './tools/vite/css-scope.ts';
import { fyldoStatic } from './tools/vite/static.ts';

const app = fileURLToPath(new URL('./app', import.meta.url));

export default defineConfig({
  plugins: [tailwindcss(), fyldoCssScope({ root: '[data-fyldo-v1]' }), fyldoStatic()],
  resolve: { alias: { '@': app } },
  build: {
    outDir: 'assets/dist',
    emptyOutDir: true,
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    modulePreload: false,
    sourcemap: false,
    rollupOptions: {
      // Base UI ships `'use client'` directives (meaningless in a plain browser bundle): drop that one warning only.
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
      input: { app: fileURLToPath(new URL('./app/main.tsx', import.meta.url)) },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (info) => (info.names?.some((n) => n.endsWith('.css')) ? 'app.css' : 'assets/[name]-[hash][extname]'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/js/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/js/setup.ts'],
    css: false,
  },
});
