/**
 * npm run i18n:compile — for every languages/fyldo-<locale>.po:
 *   fyldo-<locale>.mo    for PHP (`load_textdomain`)
 *   fyldo-<locale>.json  JED locale data for the UI (`setLocaleData` in the bundled @wordpress/i18n)
 *
 * Fails when a .po lacks a translation that exists in the .pot, so a missing string can never ship silently.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import gettext from 'gettext-parser';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = resolve(root, 'languages');

type Entry = { msgid: string; msgctxt?: string; msgid_plural?: string; msgstr: string[] };
const entries = (po: ReturnType<typeof gettext.po.parse>): Entry[] =>
  Object.entries(po.translations).flatMap(([ctx, bucket]) =>
    Object.values(bucket as Record<string, Entry>)
      .filter((e) => e.msgid !== '')
      .map((e) => ({ ...e, msgctxt: ctx || undefined })),
  );

const pot = gettext.po.parse(readFileSync(resolve(dir, 'fyldo.pot')));
const wanted = entries(pot);
let problems = 0;

for (const file of readdirSync(dir).filter((f) => /^fyldo-.+\.po$/.test(f))) {
  const locale = file.replace(/^fyldo-|\.po$/g, '');
  const po = gettext.po.parse(readFileSync(resolve(dir, file)));
  const have = new Map(entries(po).map((e) => [`${e.msgctxt ?? ''}\u0004${e.msgid}`, e]));

  for (const w of wanted) {
    const translated = have.get(`${w.msgctxt ?? ''}\u0004${w.msgid}`);
    if (!translated || translated.msgstr.every((s) => s === '')) {
      console.error(`i18n: ${file}: missing translation for "${w.msgid}"`);
      problems++;
    }
  }

  const base = resolve(dir, `fyldo-${locale}`);
  execFileSync('msgfmt', ['-o', `${base}.mo`, resolve(dir, file)]);

  const messages: Record<string, unknown> = {
    '': { domain: 'fyldo', lang: locale, 'plural-forms': po.headers['Plural-Forms'] ?? po.headers['plural-forms'] },
  };
  for (const e of entries(po)) {
    if (e.msgstr.every((s) => s === '')) continue;
    messages[e.msgctxt ? `${e.msgctxt}\u0004${e.msgid}` : e.msgid] = e.msgstr;
  }
  writeFileSync(`${base}.json`, JSON.stringify({ domain: 'messages', locale_data: { messages } }) + '\n');
  console.log(`i18n: ${locale}: ${Object.keys(messages).length - 1} strings → .mo + .json`);
}

if (problems > 0) process.exit(1);
