// Copies the gallery's HTML shell, the Persian UI strings and the lazy icon modules (from `npm run build`) next to the built gallery bundle.
import { copyFileSync, cpSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'e2e/.generated/gallery');
copyFileSync(resolve(root, 'tests/harness/gallery/index.html'), resolve(out, 'index.html'));
copyFileSync(resolve(root, 'languages/fyldo-fa_IR.json'), resolve(out, 'fyldo-fa_IR.json'));
const icons = resolve(root, 'assets/dist/icons');
if (existsSync(icons)) cpSync(icons, resolve(out, 'icons'), { recursive: true });
