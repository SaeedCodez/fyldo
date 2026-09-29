import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrast, over, parseHex } from '../../tools/tokens/color';
import { cssName, generate, resolveColor, REQUIRED_TOKENS, SHADCN_MAP } from '../../tools/tokens/generate';
import { normalizeHex, normalizeStyles, normalizeVariables, type StyleSnapshot, type TokenSnapshot } from '../../tools/tokens/snapshot';

const read = <T>(file: string): T => JSON.parse(readFileSync(resolve(__dirname, '../..', file), 'utf8')) as T;
const snapshot = read<TokenSnapshot>('tokens/figma.tokens.json');
const styles = read<StyleSnapshot>('tokens/figma.styles.json');

/** The Figma file may not have the approved focus tokens yet; everything else is tested against the real snapshot. */
const dev = () => generate(snapshot, styles, { allowMissing: true });

describe('snapshot normalisation', () => {
  it('lower-cases hex and drops an opaque alpha byte', () => {
    expect(normalizeHex('#171717FF')).toBe('#171717');
    expect(normalizeHex('#00000066')).toBe('#00000066');
    expect(normalizeHex('#FFFFFF')).toBe('#ffffff');
  });

  it('flattens DTCG into a sorted, timestamp-free list keeping code syntax', () => {
    const out = normalizeVariables({
      $extensions: { 'figma-console-mcp': { figmaFileKey: 'KEY', exportedAt: 'now' } },
      color: { b: { $type: 'color', $value: '#AABBCCFF', $extensions: { 'figma-console-mcp': { codeSyntax: { WEB: 'var(--fyldo-b)' }, lastSyncedAt: 'x' } } }, a: { $type: 'color', $value: '{color.b}' } },
    });
    expect(out.tokens).toEqual([
      { name: 'color.a', type: 'color', value: '{color.b}' },
      { name: 'color.b', type: 'color', value: '#aabbcc', css: '--fyldo-b' },
    ]);
    expect(JSON.stringify(out)).not.toContain('exportedAt');
  });

  it('rounds Figma float artefacts in styles', () => {
    const out = normalizeStyles({
      textStyles: [{ name: 'EN/Heading/32', family: 'Geist', style: 'SemiBold', size: 32, lineHeight: { unit: 'PIXELS', value: 40 }, letterSpacing: { unit: 'PIXELS', value: -1.2799999713897705 } }],
      effectStyles: [],
    });
    expect(out.textStyles[0]?.letterSpacing).toBe(-1.28);
  });
});

describe('generator', () => {
  it('is deterministic', () => {
    expect(dev().css).toBe(dev().css);
  });

  it('every semantic colour becomes a custom property, a theme colour and keeps its alias', () => {
    const { css } = dev();
    const semantic = snapshot.tokens.filter((t) => t.name.startsWith('color.') && t.name !== 'color.focus.ring');
    expect(semantic.length).toBeGreaterThan(50);
    for (const t of semantic) {
      expect(css, t.name).toContain(`  ${cssName(t)}: `);
      expect(css, t.name).toContain(`--color-${t.name.slice('color.'.length).replace(/\./g, '-')}: var(${cssName(t)})`);
    }
    expect(css).toContain('--fyldo-action-primary: var(--fyldo-gray-1000);');
  });

  it('uses Figma’s own code-syntax names (--fyldo-*) and derives the rest by the same rule', () => {
    const byName = new Map(snapshot.tokens.map((t) => [t.name, t]));
    expect(cssName(byName.get('color.action.danger')!)).toBe('--fyldo-action-danger');
    expect(cssName(byName.get('primitives.color.gray.1000')!)).toBe('--fyldo-gray-1000');
    expect(cssName({ name: 'color.background.overlay', type: 'color', value: '#00000066' })).toBe('--fyldo-background-overlay');
    expect(cssName({ name: 'primitives.color.white', type: 'color', value: '#ffffff' })).toBe('--fyldo-white');
  });

  it('names effect utilities without a doubled prefix (regression: shadow-shadow-thumb)', () => {
    const { css } = dev();
    for (const name of ['thumb', 'small', 'medium', 'large', 'focus-input', 'focus-input-error']) {
      expect(css, name).toContain(`--fyldo-shadow-${name}:`);
      expect(css, name).toContain(`--shadow-${name}: var(--fyldo-shadow-${name})`);
    }
    expect(css).not.toContain('shadow-shadow');
  });

  it('never emits the blue focus ring — neither token nor effect', () => {
    const { css, warnings } = dev();
    expect(css).not.toMatch(/#006bf5/i);
    expect(css).not.toContain('--fyldo-focus-ring:');
    expect(css).not.toContain('shadow-focus-ring');
    expect(warnings.join('\n')).toContain('Focus/Ring');
  });

  it('maps the shadcn variable names onto Fyldo tokens on the ROOT, not :root', () => {
    const { css } = dev();
    expect(css).toContain('--primary: var(--fyldo-action-primary);');
    expect(css).toContain('--background: var(--fyldo-background-default);');
    expect(css).toContain('--destructive: var(--fyldo-action-danger);');
    expect(css).toContain('--radius: var(--fyldo-radius-md);');
    expect(css).not.toMatch(/:root\s*\{/);
    expect(Object.keys(SHADCN_MAP)).toContain('ring');
  });

  it('text styles: EN values on the root, Persian line-height and zero tracking under [dir=rtl]', () => {
    const { css } = dev();
    expect(css).toContain('--fyldo-leading-heading-32: 40px;');
    expect(css).toContain('--fyldo-tracking-heading-32: -0.04em;');
    const rtl = css.slice(css.indexOf("[dir='rtl']"), css.indexOf('@theme inline'));
    expect(rtl).toContain('--fyldo-leading-heading-32: 48px;');
    expect(rtl).toContain('--fyldo-tracking-heading-32: 0;');
    expect(rtl).toContain('--fyldo-font-family: var(--fyldo-font-sans-fa);');
    expect(css).toMatch(/@utility text-label-14-strong \{[^}]*font-weight: 500;[^}]*font-size: 14px;/);
  });

  it('every EN text style has a Persian counterpart and a utility', () => {
    const { css } = dev();
    const en = styles.textStyles.filter((s) => s.name.startsWith('EN/'));
    expect(en.length).toBe(21);
    for (const s of en) {
      const key = s.name.slice(3);
      expect(styles.textStyles.some((o) => o.name === `FA/${key}`), key).toBe(true);
      expect(css).toContain(`@utility text-${key.toLowerCase().replace(/[\s/]+/g, '-')} {`);
    }
  });

  it('the spacing scale is Tailwind’s 4px scale, so utilities ARE tokens', () => {
    for (const t of snapshot.tokens.filter((t) => t.name.startsWith('spacing.space.'))) {
      const n = Number(t.name.split('.').pop());
      expect(Number(t.value), t.name).toBe(n);
      expect((n / 4) * 4, t.name).toBe(n); // p-<n/4> == space/<n>
    }
    expect(dev().css).toContain('--spacing: 4px;');
  });

  it('is STRICT: a missing Figma token fails the build and names it (the fallback is for local development only)', () => {
    const without: TokenSnapshot = { ...snapshot, tokens: snapshot.tokens.filter((t) => !REQUIRED_TOKENS.includes(t.name)) };
    expect(() => generate(without, styles)).toThrow(/focus\/ring-neutral, focus\/border/);
    expect(generate(without, styles, { allowMissing: true }).warnings.join(' ')).toContain('FALLBACK');
  });

  it('resolves aliases to final colours and detects cycles', () => {
    expect(resolveColor(snapshot, 'color.action.primary')).toBe('#171717');
    const cyclic: TokenSnapshot = { ...snapshot, tokens: [{ name: 'a', type: 'color', value: '{b}' }, { name: 'b', type: 'color', value: '{a}' }] };
    expect(() => resolveColor(cyclic, 'a')).toThrow(/cycle/i);
  });
});

describe('colour maths', () => {
  it('matches known WCAG ratios', () => {
    const c = (a: string, b: string) => contrast(parseHex(a), parseHex(b));
    expect(c('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(c('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(c('#171717', '#ffffff')).toBeCloseTo(17.93, 2);
  });

  it('composites alpha over the background', () => {
    const scrim = over(parseHex('#00000066'), parseHex('#ffffff'));
    expect(Math.round(scrim.r)).toBe(153);
  });
});
