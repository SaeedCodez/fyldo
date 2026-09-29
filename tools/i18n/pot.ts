/**
 * npm run i18n:pot → languages/fyldo.pot
 *
 * PHP strings come from `wp i18n make-pot` (the official extractor). WP-CLI does not scan `.ts/.tsx`, so the UI strings
 * (`__( 'text', 'fyldo' )`, `_n`, `_x` in app/) are extracted here with the TypeScript compiler API and merged in.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
// gettext-parser 1.x (CommonJS) — a transitive dependency of @wordpress/i18n
import gettext from 'gettext-parser';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DOMAIN = 'fyldo';

interface Entry {
  msgctxt?: string;
  msgid: string;
  msgid_plural?: string;
  msgstr: string[];
  comments: { reference?: string; extracted?: string };
}

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.generated.ts') && !name.endsWith('.d.ts')) yield path;
  }
}

const literal = (node: ts.Node | undefined): string | undefined =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;

/** `__( 'a', 'fyldo' )`, `_x( 'a', 'ctx', 'fyldo' )`, `_n( 'one', 'many', n, 'fyldo' )` with a literal domain. */
export function extractFromSource(file: string, source: string): Entry[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const entries: Entry[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const fn = node.expression.text;
      const args = node.arguments;
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
      const ref = `${relative(root, file)}:${line + 1}`;

      if (fn === '__' && literal(args[1]) === DOMAIN && literal(args[0]) !== undefined) {
        entries.push({ msgid: literal(args[0]) as string, msgstr: [''], comments: { reference: ref } });
      } else if (fn === '_x' && literal(args[2]) === DOMAIN && literal(args[0]) !== undefined) {
        entries.push({ msgid: literal(args[0]) as string, msgctxt: literal(args[1]), msgstr: [''], comments: { reference: ref } });
      } else if (fn === '_n' && literal(args[3]) === DOMAIN && literal(args[0]) !== undefined && literal(args[1]) !== undefined) {
        entries.push({ msgid: literal(args[0]) as string, msgid_plural: literal(args[1]), msgstr: ['', ''], comments: { reference: ref } });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return entries;
}

function main(): void {
  mkdirSync(resolve(root, 'build'), { recursive: true });
  const phpPot = resolve(root, 'build/php.pot');
  execFileSync(
    'wp',
    ['i18n', 'make-pot', root, phpPot, `--domain=${DOMAIN}`, '--slug=fyldo', '--include=src,fyldo.php', '--skip-js', '--skip-audit'],
    { stdio: 'inherit' },
  );

  const pot = gettext.po.parse(readFileSync(phpPot));
  const translations = pot.translations as Record<string, Record<string, Entry>>;

  for (const file of files(resolve(root, 'app'))) {
    for (const entry of extractFromSource(file, readFileSync(file, 'utf8'))) {
      const ctx = entry.msgctxt ?? '';
      const bucket = (translations[ctx] ??= {});
      const existing = bucket[entry.msgid];
      if (existing) {
        existing.comments = { ...existing.comments, reference: [existing.comments?.reference, entry.comments.reference].filter(Boolean).join('\n') };
      } else {
        bucket[entry.msgid] = entry;
      }
    }
  }

  // Deterministic order: by first reference, then msgid.
  for (const ctx of Object.keys(translations)) {
    const bucket = translations[ctx] as Record<string, Entry>;
    const sorted = Object.values(bucket).sort((a, b) => {
      if (a.msgid === '') return -1;
      if (b.msgid === '') return 1;
      return (a.comments?.reference ?? '').localeCompare(b.comments?.reference ?? '') || a.msgid.localeCompare(b.msgid);
    });
    translations[ctx] = Object.fromEntries(sorted.map((e) => [e.msgid, e]));
  }

  pot.headers = { ...pot.headers, 'POT-Creation-Date': 'YEAR-MO-DA HO:MI+ZONE' };
  mkdirSync(resolve(root, 'languages'), { recursive: true });
  writeFileSync(resolve(root, 'languages/fyldo.pot'), gettext.po.compile(pot));
  console.log(`i18n: ${Object.values(translations).reduce((n, b) => n + Object.keys(b).length, 0) - 1} strings → languages/fyldo.pot`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
