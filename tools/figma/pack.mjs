#!/usr/bin/env node
/**
 * Companion of tools/figma/export-pack.js (which runs inside Figma via the figma-console MCP `figma_execute`).
 *
 *   node tools/figma/pack.mjs code <mode> [--set "Button"] [--id 8:1984] [--start 0] [--scale 2]
 *       Prints a figma_execute snippet: the extractor (installs globalThis.fyldoPack) followed by one call to it.
 *       `--set` takes a set name from design/figma/index.json; `--id` a raw node id. Paste the snippet into
 *       figma_execute; the harness saves large results to a file and prints its path.
 *   node tools/figma/pack.mjs decode <result-file>...
 *       Writes design/figma/components/<kebab>.json (merging batches), design/figma/png/**.png, or the set list.
 *       Prints the `next` start index when a batch is not finished (re-run `code` with --start <next>).
 *   node tools/figma/pack.mjs index
 *       Rebuilds design/figma/index.json from what is on disk plus the last `list` result.
 *   node tools/figma/pack.mjs verify
 *       Checks index.json against disk (files, variant counts, PNG signatures, sizes) and prints the pack size.
 *
 * Refresh one component: `code json --set Toast` → figma_execute → `decode <file>` (repeat while it prints a `next`),
 * then the same with `code png --set Toast`, then `index` and `verify`.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pack = join(root, 'design/figma');
const cache = join(root, '.tools/figma-pack');
const listFile = join(cache, 'list.json');
const PNG_SIG = '89504e470d0a1a0a';

const write = (file, data) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
};
const writeJson = (file, value) => write(file, JSON.stringify(value, null, 1) + '\n');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const walk = (dir) =>
  !existsSync(dir)
    ? []
    : readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });

const [, , cmd, ...rest] = process.argv;

if (cmd === 'code') {
  const mode = rest[0];
  const params = { mode };
  const index = existsSync(join(pack, 'index.json')) ? readJson(join(pack, 'index.json')) : null;
  const list = existsSync(listFile) ? readJson(listFile) : null;
  const wanted = arg('set');
  if (wanted) {
    const hit = (index?.components ?? list?.sets ?? []).find((s) => s.name === wanted);
    if (!hit) throw new Error(`unknown set "${wanted}"; run the list mode first`);
    params.setId = hit.id ?? hit.nodeId;
  }
  if (arg('id')) params.setId = arg('id');
  if (arg('start')) params.start = Number(arg('start'));
  if (arg('scale')) params.scale = Number(arg('scale'));
  if (mode === 'frames') params.ids = (list?.frames ?? []).map((f) => f.id);
  const extractor = readFileSync(join(root, 'tools/figma/export-pack.js'), 'utf8');
  process.stdout.write(extractor.replace(/\nreturn 'fyldoPack installed';\n$/, '\n') + `return await globalThis.fp([${JSON.stringify(params)}]);\n`);
} else if (cmd === 'decode') {
  for (const file of rest) {
    const raw = readJson(file);
    const top = raw.result ?? raw;
    if (top.pending && top.pending.length) console.log('PENDING (re-run):', JSON.stringify(top.pending));
    for (const res of top.batch ?? [top]) {
    if (res.mode === 'list') {
      writeJson(listFile, res);
      console.log(`list: ${res.sets.length} sets, ${res.frames.length} frames, ${res.variableCount} variables`);
    } else if (res.mode === 'json') {
      const out = join(pack, 'components', `${res.set.kebab}.json`);
      const prev = res.start > 0 && existsSync(out) ? readJson(out) : { variants: [] };
      const variants = [...prev.variants.slice(0, res.start), ...res.variants];
      writeJson(out, {
        source: { fileKey: 'Pg3Ni7eqTLQYIG6hfNVPt6', page: 'Components', nodeId: res.set.id },
        set: res.set,
        variants,
      });
      console.log(`${res.set.name}: ${variants.length}/${res.total} variants${res.done ? ' (done)' : `, next start ${res.next}`}`);
    } else if (res.mode === 'png' || res.mode === 'frames') {
      for (const f of res.files) {
        const bytes = Buffer.from(f.b64, 'base64');
        if (bytes.length === 0 || bytes.length !== f.bytes || bytes.subarray(0, 8).toString('hex') !== PNG_SIG) throw new Error(`bad PNG for ${f.path}`);
        write(join(pack, f.path), bytes);
      }
      console.log(`${res.mode}: wrote ${res.files.length} files (${res.next}/${res.total})${res.done ? ' (done)' : `, next start ${res.next}`}`);
    } else throw new Error(`unknown result in ${file}`);
    }
  }
} else if (cmd === 'index' || cmd === 'verify') {
  const list = readJson(listFile);
  const rel = (p) => relative(pack, p).split('\\').join('/');
  const pngs = walk(join(pack, 'png'));
  if (cmd === 'index') {
    const components = list.sets.map((s) => {
      const file = join(pack, 'components', `${s.kebab}.json`);
      const data = existsSync(file) ? readJson(file) : null;
      const dir = join(pack, 'png', s.kebab);
      return {
        name: s.name,
        nodeId: s.id,
        variantCount: s.variantCount,
        json: rel(file),
        jsonVariantCount: data ? data.variants.length : 0,
        png: pngs.filter((p) => p.startsWith(dir + '/')).map(rel).sort(),
      };
    });
    const usage = list.frames.map((f) => ({ name: f.name, nodeId: f.id, width: f.width, height: f.height, png: `png/usage/${f.kebab}.png`, scale: 1 }));
    writeJson(join(pack, 'index.json'), {
      exportedAt: new Date().toISOString().slice(0, 10),
      source: { fileName: list.fileName, fileKey: 'Pg3Ni7eqTLQYIG6hfNVPt6', page: 'Components' },
      variableCount: list.variableCount,
      componentCount: components.length,
      variantCount: components.reduce((n, c) => n + c.variantCount, 0),
      pngScale: { variants: 2, usage: 1 },
      components,
      usage,
    });
    console.log(`index.json: ${components.length} components, ${usage.length} usage/template frames`);
  } else {
    const index = readJson(join(pack, 'index.json'));
    const tokens = readJson(join(root, 'tokens/figma.tokens.json'));
    const problems = [];
    if (index.variableCount !== 150) problems.push(`variableCount ${index.variableCount} != 150`);
    if (index.variableCount !== tokens.tokens.length) problems.push(`variableCount ${index.variableCount} != tokens/figma.tokens.json ${tokens.tokens.length}`);
    for (const c of index.components) {
      if (!existsSync(join(pack, c.json))) problems.push(`${c.name}: missing ${c.json}`);
      if (c.jsonVariantCount !== c.variantCount) problems.push(`${c.name}: JSON has ${c.jsonVariantCount} variants, Figma ${c.variantCount}`);
      if (c.png.length !== c.variantCount) problems.push(`${c.name}: ${c.png.length} PNGs for ${c.variantCount} variants`);
    }
    for (const u of index.usage) if (!existsSync(join(pack, u.png))) problems.push(`${u.name}: missing ${u.png}`);
    let bytes = 0;
    let files = 0;
    for (const f of walk(pack)) {
      const size = statSync(f).size;
      bytes += size;
      files++;
      if (f.endsWith('.png')) {
        if (size === 0) problems.push(`empty ${rel(f)}`);
        else if (readFileSync(f).subarray(0, 8).toString('hex') !== PNG_SIG) problems.push(`not a PNG: ${rel(f)}`);
      }
    }
    console.log(`components ${index.componentCount}, variants ${index.variantCount}, files ${files}, pack ${(bytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'verify: OK');
    process.exitCode = problems.length ? 1 : 0;
  }
} else {
  console.error('usage: pack.mjs code|decode|index|verify (see the header of this file)');
  process.exitCode = 2;
}
