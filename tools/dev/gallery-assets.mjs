// Copies the gallery's HTML shell and the Persian UI strings next to the built gallery bundle.
import { copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'e2e/.generated/gallery');
copyFileSync(resolve(root, 'tests/harness/gallery/index.html'), resolve(out, 'index.html'));
copyFileSync(resolve(root, 'languages/fyldo-fa_IR.json'), resolve(out, 'fyldo-fa_IR.json'));
