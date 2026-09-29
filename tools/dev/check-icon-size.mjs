// Budget: no single lazily-loaded icon module may exceed 2 kB gzipped (size-limit only measures globs as a sum).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../assets/dist/icons');
const LIMIT = 2048;
const sizes = readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => [f, gzipSync(readFileSync(resolve(dir, f))).length]);
const [name, max] = sizes.reduce((a, b) => (b[1] > a[1] ? b : a));
console.log(`icons: ${sizes.length} modules, largest ${name} = ${max} B gzipped (limit ${LIMIT} B)`);
if (max > LIMIT) process.exit(1);
