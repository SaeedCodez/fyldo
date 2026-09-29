/**
 * npm run tokens         → writes app/styles/tokens.generated.css
 * npm run tokens:check   → regenerates in memory and fails when the committed file differs (CI)
 *
 * TOKENS_ALLOW_MISSING=1 lets local development continue while Figma lacks tokens; CI never sets it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './generate.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const target = resolve(root, 'app/styles/tokens.generated.css');
const read = (file: string) => JSON.parse(readFileSync(resolve(root, file), 'utf8'));

const { css, warnings } = generate(read('tokens/figma.tokens.json'), read('tokens/figma.styles.json'), {
  allowMissing: process.env.TOKENS_ALLOW_MISSING === '1',
});
for (const w of warnings) console.warn(`tokens: warning: ${w}`);

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(target, 'utf8');
  } catch {
    // missing file = out of date
  }
  if (current !== css) {
    console.error('tokens: app/styles/tokens.generated.css is out of date. Run `npm run tokens` and commit the result.');
    process.exit(1);
  }
  console.log('tokens: up to date.');
} else {
  writeFileSync(target, css);
  console.log(`tokens: wrote ${target.replace(root + '/', '')}`);
}
