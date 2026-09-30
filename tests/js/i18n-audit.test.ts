import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * Every string the UI shows goes through the text domain (M5): no literal text in JSX and no literal user-facing
 * attribute, and every `__` / `_x` / `_n` call names the `fyldo` domain (the pot extractor only sees calls that do).
 * Completeness of the Persian .po is checked by `npm run i18n` (tools/i18n/compile.ts).
 */
const APP = resolve(__dirname, '../../app');

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.tsx?$/.test(name) && !name.includes('.generated.')) yield path;
  }
}

const USER_FACING = /^(aria-label|aria-description|title|placeholder|alt|label|description|helper|error|message|cancelLabel|confirmLabel)$/;
const I18N_CALL = /^(__|_x|_n)$/;
const DOMAIN_ARG = { __: 1, _x: 2, _n: 3 } as const;

function audit(): { literals: string[]; domains: string[] } {
  const literals: string[] = [];
  const domains: string[] = [];
  for (const file of sources(APP)) {
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const at = (n: ts.Node) => `${file.slice(APP.length + 1)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
    const visit = (n: ts.Node): void => {
      if (ts.isJsxText(n) && /[\p{L}]/u.test(n.text)) literals.push(`${at(n)} text ${JSON.stringify(n.text.trim())}`);
      if (ts.isJsxAttribute(n) && USER_FACING.test(n.name.getText()) && n.initializer && ts.isStringLiteral(n.initializer) && /\p{L}{2}/u.test(n.initializer.text)) {
        literals.push(`${at(n)} ${n.name.getText()}=${JSON.stringify(n.initializer.text)}`);
      }
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && I18N_CALL.test(n.expression.text)) {
        const name = n.expression.text as keyof typeof DOMAIN_ARG;
        const domain = n.arguments[DOMAIN_ARG[name]];
        const text = n.arguments[0];
        const ok = domain && ts.isStringLiteral(domain) && domain.text === 'fyldo' && text && (ts.isStringLiteral(text) || ts.isNoSubstitutionTemplateLiteral(text));
        if (!ok) domains.push(`${at(n)} ${n.getText().slice(0, 60)}`);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return { literals, domains };
}

describe('i18n audit', () => {
  const { literals, domains } = audit();

  it('has no literal text or user-facing literal attribute in JSX', () => {
    expect(literals).toEqual([]);
  });

  it('calls __, _x and _n with a literal text and the literal "fyldo" domain', () => {
    expect(domains).toEqual([]);
  });
});
