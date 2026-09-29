/**
 * Copies the self-hosted variable fonts (SIL OFL, from @fontsource-variable) into assets/dist/fonts and writes
 * assets/dist/fonts.css with namespaced families ("Fyldo Geist" …) so we never override a site's own "Geist".
 *
 * `unicode-range` is kept per subset, so an English page never downloads the Arabic file and vice versa.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_OUT = resolve(root, 'assets/dist');

interface Source {
  pkg: string;
  css: string;
  family: string;
  subsets: string[];
}

const SOURCES: Source[] = [
  { pkg: 'geist', css: 'wght.css', family: 'Fyldo Geist', subsets: ['latin', 'latin-ext'] },
  { pkg: 'geist-mono', css: 'wght.css', family: 'Fyldo Geist Mono', subsets: ['latin', 'latin-ext'] },
  { pkg: 'vazirmatn', css: 'wght.css', family: 'Fyldo Vazirmatn', subsets: ['arabic', 'latin', 'latin-ext'] },
];

export function buildFonts(out: string = DEFAULT_OUT): string[] {
  mkdirSync(resolve(out, 'fonts'), { recursive: true });
  const blocks: string[] = [
    '/* Fyldo fonts — self-hosted, SIL Open Font License 1.1. Families are namespaced on purpose. */',
  ];
  const copied: string[] = [];

  for (const source of SOURCES) {
    const dir = resolve(root, 'node_modules/@fontsource-variable', source.pkg);
    const css = readFileSync(resolve(dir, source.css), 'utf8');

    for (const block of css.match(/\/\*[^*]*\*\/\s*@font-face\s*{[^}]*}/g) ?? []) {
      const subset = /\/\*\s*[\w-]+?-([a-z-]+)-wght-normal\s*\*\//.exec(block)?.[1];
      if (!subset || !source.subsets.includes(subset)) continue;

      const file = /url\(\.\/files\/([^)]+\.woff2)\)/.exec(block)?.[1];
      const range = /unicode-range:\s*([^;]+);/.exec(block)?.[1];
      if (!file || !range) throw new Error(`Cannot parse ${source.pkg} ${subset}`);

      const from = resolve(dir, 'files', file);
      if (!existsSync(from)) throw new Error(`Missing font file ${from}`);
      copyFileSync(from, resolve(out, 'fonts', file));
      copied.push(file);

      blocks.push(
        `@font-face {\n  font-family: '${source.family}';\n  font-style: normal;\n  font-weight: 100 900;\n  font-display: swap;\n` +
          `  src: url(./fonts/${file}) format('woff2');\n  unicode-range: ${range};\n}`,
      );
    }
  }

  writeFileSync(resolve(out, 'fonts.css'), blocks.join('\n\n') + '\n');
  return copied;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`fonts: ${buildFonts().length} files copied`);
}
