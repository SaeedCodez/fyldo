/**
 * Emits everything that is not part of the Vite module graph, after the bundle is written:
 *   - assets/dist/boot.js      the ONLY classic <script> WordPress prints (loads app.js as an ES module)
 *   - assets/dist/fonts.css + fonts/*.woff2
 *   - assets/dist/icons/<key>.js   every Iconsax Linear icon, loaded on demand
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { buildFonts } from '../fonts/build.ts';
import { buildIconModules } from '../icons/build.ts';

/**
 * `document.currentScript` is the WordPress-printed <script>; app.js sits next to it, whichever plugin URL
 * (plugin, drop-in, Composer vendor dir, Strauss copy) the copy runs from. Nothing is written to `window`.
 */
export const BOOT_JS =
  '(function(){var s=document.currentScript;if(!s||!s.src)return;' +
  "import(new URL('app.js',s.src).href).catch(function(e){console.error('Fyldo: could not load the app',e)})})();\n";

export function fyldoStatic(): Plugin {
  let outDir = '';
  return {
    name: 'fyldo-static',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async writeBundle() {
      writeFileSync(resolve(outDir, 'boot.js'), BOOT_JS);
      const fonts = buildFonts();
      const icons = await buildIconModules(resolve(outDir, 'icons'));
      console.log(`fyldo-static: boot.js, ${fonts.length} font files, ${icons} icon modules`);
    },
  };
}
