import { describe, expect, it } from 'vitest';
import { scopeCss, scopeSelector } from '../../tools/vite/css-scope';

const ROOT = '[data-fyldo-v1]';
const BUMP = `${ROOT}${ROOT}:not(#\\#)`;

describe('scopeSelector', () => {
  it('prefixes plain selectors with the doubled, ID-level root', () => {
    expect(scopeSelector('.fy\\:flex', ROOT)).toBe(`${BUMP} .fy\\:flex`);
    expect(scopeSelector('*', ROOT)).toBe(`${BUMP} *`);
    expect(scopeSelector('::backdrop', ROOT)).toBe(`${BUMP} ::backdrop`);
  });

  it('turns root-targeting selectors into compound selectors', () => {
    expect(scopeSelector(':root', ROOT)).toBe(BUMP);
    expect(scopeSelector(':host', ROOT)).toBe(BUMP);
    expect(scopeSelector(ROOT, ROOT)).toBe(BUMP);
    expect(scopeSelector(`${ROOT}[dir='rtl']`, ROOT)).toBe(`${BUMP}[dir='rtl']`);
    expect(scopeSelector(`${ROOT} :where(h1)`, ROOT)).toBe(`${BUMP} :where(h1)`);
  });

  it('keeps the WP-chrome offsets scoped by the body class only', () => {
    expect(scopeSelector('body.fyldo-screen #wpfooter', ROOT)).toBe('body.fyldo-screen #wpfooter');
  });
});

describe('scopeCss', () => {
  it('flattens @layer in DECLARATION order, not source order (wp-admin is unlayered and would beat layered rules)', () => {
    const css = `
      @layer theme, base, utilities;
      @layer utilities { .u { color: red } }
      @layer base { .b { color: blue } }
      @layer theme { :root { --x: 1 } }
      .after { color: green }
    `;
    const out = scopeCss(css, { root: ROOT });
    expect(out).not.toContain('@layer');
    const order = ['--x: 1', 'color: blue', 'color: red', 'color: green'].map((needle) => out.indexOf(needle));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order); // theme → base → utilities → unlayered
  });

  it('scopes rules inside @media / @supports but not nested (&:hover) rules', () => {
    const out = scopeCss(`@media (min-width: 1px) { .a { color: red; &:hover { color: blue } } } @supports (display: grid) { .b { display: grid } }`, { root: ROOT });
    expect(out).toContain(`${BUMP} .a`);
    expect(out).toContain('&:hover');
    expect(out).not.toContain(`${BUMP} &:hover`);
    expect(out).toContain(`${BUMP} .b`);
  });

  it('namespaces @keyframes and the animations that use them', () => {
    const out = scopeCss(`@keyframes spin { to { transform: rotate(1turn) } } .x { animation: spin 1s linear infinite } @keyframes fyldo-spin { to { opacity: 1 } }`, { root: ROOT });
    expect(out).toContain('@keyframes fyldo-spin');
    expect(out).not.toContain('fyldo-fyldo');
    expect(out).toContain('animation: fyldo-spin 1s');
    expect(out).not.toMatch(/@keyframes spin\b/);
  });

  it('every emitted style rule is scoped', () => {
    const out = scopeCss(`@layer utilities { .a, .b:hover, :where(.c, .d) { color: red } } h1 { margin: 0 } body.fyldo-screen #x { display: none }`, { root: ROOT });
    const selectors = [...out.matchAll(/([^{}]+)\{/g)].flatMap((m) => (m[1] as string).split(/,(?![^(]*\))/).map((s) => s.trim()));
    for (const s of selectors) expect(s.startsWith(BUMP) || s.startsWith('body.fyldo-screen'), s).toBe(true);
  });
});
