/**
 * Figma snapshot → Tailwind v4 `@theme` + CSS custom properties (pure functions, unit-tested).
 *
 * Output layout (docs/ARCHITECTURE.md §9.1):
 *   1. `[data-fyldo-v1] { --fyldo-* … }`   primitives, semantic aliases, spacing, radius, effects, fonts, text-style vars,
 *                                           plus the shadcn variable names (--background, --primary, --ring …)
 *   2. `[data-fyldo-v1][dir='rtl'] { … }`   Persian font + line-heights + tracking (Figma `fa/*` tokens)
 *   3. `@theme inline { … }`                utilities (`fy:bg-action-primary`, `fy:rounded-md`, `fy:shadow-medium`)
 *   4. `@utility text-*`                    one per Figma text style (`fy:text-label-14-strong`)
 *
 * Sizes are px on purpose: another plugin/theme changing the root font-size must not resize the UI.
 */
import { createHash } from 'node:crypto';
import type { StyleSnapshot, Token, TokenSnapshot } from './snapshot.ts';

export interface GenerateOptions {
  rootSelector: string;
  /** Local development only: fall back when the Figma focus tokens are not there yet. CI never sets this. */
  allowMissing: boolean;
}

export const DEFAULTS: GenerateOptions = { rootSelector: '[data-fyldo-v1]', allowMissing: false };

/** Figma font names → the self-hosted families we ship (Vazirmatn replaces IRANYekanX in code). */
export const FONT_STACKS: Record<string, string> = {
  Geist: '"Fyldo Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  'Geist Mono': '"Fyldo Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  IRANYekanX: '"Fyldo Vazirmatn", "Fyldo Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
};

export const FONT_WEIGHTS: Record<string, number> = { Regular: 400, Medium: 500, SemiBold: 600, DemiBold: 600 };

/** shadcn variable → Fyldo semantic token (path without the `color.` root). */
export const SHADCN_MAP: Record<string, string> = {
  background: 'background.default',
  foreground: 'text.primary',
  card: 'background.default',
  'card-foreground': 'text.primary',
  popover: 'background.default',
  'popover-foreground': 'text.primary',
  primary: 'action.primary',
  'primary-foreground': 'text.inverse',
  secondary: 'action.secondary',
  'secondary-foreground': 'text.primary',
  muted: 'surface.default',
  'muted-foreground': 'text.secondary',
  accent: 'surface.default',
  'accent-foreground': 'text.primary',
  destructive: 'action.danger',
  'destructive-foreground': 'text.inverse',
  border: 'border.default',
  input: 'border.default',
  ring: 'focus.ring-neutral',
  sidebar: 'background.subtle',
  'sidebar-foreground': 'text.primary',
  'sidebar-primary': 'action.primary',
  'sidebar-primary-foreground': 'text.inverse',
  'sidebar-accent': 'surface.active',
  'sidebar-accent-foreground': 'text.primary',
  'sidebar-border': 'border.default',
  'sidebar-ring': 'focus.ring-neutral',
};

/** Tokens the components rely on that Figma must define (besides those in SHADCN_MAP). */
export const REQUIRED_TOKENS = ['color.focus.ring-neutral', 'color.focus.border'];

/** Effect styles that are intentionally not generated. */
export const SKIPPED_EFFECTS: Record<string, string> = {
  'Focus/Ring': 'blue focus ring — replaced by the neutral ring built from focus/ring-neutral',
};

/** Variables that exist in Figma but must never reach the code. */
export const SKIPPED_TOKENS: Record<string, string> = {
  'color.focus.ring': 'blue focus ring — never used; the neutral ring comes from focus/ring-neutral',
};

/** Fallbacks used only with `allowMissing` (local development while Figma is catching up). */
const FALLBACKS: Record<string, string> = {
  'color.focus.ring-neutral': 'color.action.primary',
  'color.focus.border': 'color.action.primary',
};

const byName = (snapshot: TokenSnapshot) => new Map(snapshot.tokens.map((t) => [t.name, t]));

/** `--fyldo-…` name of a token: Figma's WEB code syntax when present, otherwise derived from the path. */
export function cssName(token: Token): string {
  if (token.css) return token.css;
  const parts = token.name.split('.');
  if (parts[0] === 'primitives') parts.splice(0, parts[1] === 'color' ? 2 : 1);
  else if (parts[0] === 'color' || parts[0] === 'spacing') parts.shift();
  return '--fyldo-' + parts.join('-');
}

/** Final colour (`#rrggbb[aa]`) of a token, following aliases. */
export function resolveColor(snapshot: TokenSnapshot, name: string, seen: string[] = []): string {
  const token = byName(snapshot).get(name);
  if (!token) throw new Error(`Unknown token "${name}"`);
  if (seen.includes(name)) throw new Error(`Alias cycle: ${[...seen, name].join(' → ')}`);
  const value = String(token.value);
  const alias = /^\{(.+)\}$/.exec(value);
  return alias ? resolveColor(snapshot, alias[1] as string, [...seen, name]) : value;
}

const px = (n: number) => `${n}px`;
const trim = (n: number) => String(Math.round(n * 10000) / 10000);

function tokenValue(snapshot: TokenSnapshot, token: Token): string {
  const value = token.value;
  if (typeof value === 'string' && value.startsWith('{')) {
    const target = byName(snapshot).get(value.slice(1, -1));
    if (!target) throw new Error(`Token ${token.name} aliases unknown token ${value}`);
    return `var(${cssName(target)})`;
  }
  if (token.type === 'dimension') return px(Number(value));
  if (token.type === 'fontFamily') {
    const stack = FONT_STACKS[String(value)];
    if (!stack) throw new Error(`No self-hosted font mapping for "${value}" (token ${token.name})`);
    return stack;
  }
  return String(value);
}

const styleKey = (name: string) => name.replace(/^(EN|FA)\//, '');
const utilityName = (key: string) => 'text-' + key.toLowerCase().replace(/[\s/]+/g, '-');
const textVar = (kind: 'leading' | 'tracking', key: string) => `--fyldo-${kind}-${utilityName(key).slice(5)}`;

export interface Generated {
  css: string;
  warnings: string[];
}

export function generate(
  snapshot: TokenSnapshot,
  styles: StyleSnapshot,
  options: Partial<GenerateOptions> = {},
): Generated {
  const opts = { ...DEFAULTS, ...options };
  const warnings: string[] = [];
  const tokens = byName(snapshot);

  // ── Required tokens ────────────────────────────────────────────────────────────────────────────────
  const missing = [...REQUIRED_TOKENS, ...Object.values(SHADCN_MAP).map((p) => `color.${p}`)].filter(
    (name, i, all) => all.indexOf(name) === i && !tokens.has(name),
  );
  if (missing.length > 0) {
    const list = missing.map((m) => m.replace(/^color\./, '').replace(/\./g, '/')).join(', ');
    if (!opts.allowMissing) throw new Error(`Figma is missing token(s) the code needs: ${list}. Add them in Figma, then re-run figma:sync.`);
    warnings.push(`FALLBACK in use for missing Figma token(s): ${list} — development only, CI must not allow this.`);
  }

  const reference = (path: string): string => {
    const full = `color.${path}`;
    const token = tokens.get(full) ?? (opts.allowMissing && FALLBACKS[full] ? tokens.get(FALLBACKS[full] as string) : undefined);
    if (!token) throw new Error(`Unknown token ${full}`);
    return `var(${cssName(token)})`;
  };

  const out: string[] = [];
  const root: string[] = [];
  const emitGroup = (title: string, list: Token[]) => {
    if (list.length === 0) return;
    root.push(`  /* ${title} */`);
    for (const t of list) root.push(`  ${cssName(t)}: ${tokenValue(snapshot, t)};`);
  };
  const where = (prefix: string) => snapshot.tokens.filter((t) => t.name.startsWith(prefix) && !SKIPPED_TOKENS[t.name]);
  for (const [name, why] of Object.entries(SKIPPED_TOKENS)) if (tokens.has(name)) warnings.push(`Token ${name} skipped: ${why}.`);

  // Fonts and weights are handled separately; everything else is emitted 1:1.
  emitGroup('Primitives', where('primitives.'));
  emitGroup('Semantic colour', where('color.'));
  emitGroup('Spacing', where('spacing.space.'));
  emitGroup('Radius', where('spacing.radius.'));
  emitGroup('Borders', where('spacing.border-width.'));
  emitGroup('Fonts', snapshot.tokens.filter((t) => t.type === 'fontFamily'));

  // Effects
  const effects = styles.effectStyles.filter((e) => {
    const why = SKIPPED_EFFECTS[e.name];
    if (why) warnings.push(`Effect style "${e.name}" skipped: ${why}.`);
    return !why;
  });
  const effectVar = (name: string) => '--fyldo-shadow-' + name.replace(/[\s/]+/g, '-').toLowerCase();
  root.push('  /* Effects */');
  for (const e of effects) {
    root.push(`  ${effectVar(e.name)}: ${e.layers.map((l) => `${px(l.x)} ${px(l.y)} ${px(l.blur)} ${px(l.spread)} ${l.color}`).join(', ')};`);
  }

  // Active font family (switches with direction)
  const sansEn = tokens.get('typography.en.font-family.sans');
  const monoEn = tokens.get('typography.en.font-family.mono');
  const sansFa = tokens.get('typography.fa.font-family.sans');
  const monoFa = tokens.get('typography.fa.font-family.mono');
  if (!sansEn || !monoEn || !sansFa || !monoFa) throw new Error('Typography font-family tokens are missing');
  root.push('  /* Active fonts (RTL switches below) */');
  root.push(`  --fyldo-font-family: var(${cssName(sansEn)});`);
  root.push(`  --fyldo-font-family-mono: var(${cssName(monoEn)});`);

  // Text styles: EN values on the root, FA overrides under [dir=rtl]
  const en = styles.textStyles.filter((s) => s.name.startsWith('EN/'));
  const fa = new Map(styles.textStyles.filter((s) => s.name.startsWith('FA/')).map((s) => [styleKey(s.name), s]));
  const rtl: string[] = [`  --fyldo-font-family: var(${cssName(sansFa)});`, `  --fyldo-font-family-mono: var(${cssName(monoFa)});`];
  root.push('  /* Text styles (EN) */');
  for (const s of en) {
    const key = styleKey(s.name);
    const other = fa.get(key);
    if (!other) throw new Error(`Text style "${s.name}" has no FA counterpart`);
    if ((FONT_WEIGHTS[s.style] ?? 0) !== (FONT_WEIGHTS[other.style] ?? -1)) warnings.push(`Weight differs between EN/${key} and FA/${key}`);
    const leading = (v: number | null) => (v === null ? 'normal' : px(v));
    const tracking = (v: number, size: number) => (v === 0 ? '0' : trim(v / size) + 'em');
    root.push(`  ${textVar('leading', key)}: ${leading(s.lineHeight)};`);
    root.push(`  ${textVar('tracking', key)}: ${tracking(s.letterSpacing, s.size)};`);
    if (leading(other.lineHeight) !== leading(s.lineHeight)) rtl.push(`  ${textVar('leading', key)}: ${leading(other.lineHeight)};`);
    if (tracking(other.letterSpacing, other.size) !== tracking(s.letterSpacing, s.size)) {
      rtl.push(`  ${textVar('tracking', key)}: ${tracking(other.letterSpacing, other.size)};`);
    }
  }

  // shadcn names
  root.push('  /* shadcn/ui variable names → Fyldo tokens */');
  for (const [name, path] of Object.entries(SHADCN_MAP)) root.push(`  --${name}: ${reference(path)};`);
  root.push(`  --radius: var(${cssName(tokens.get('spacing.radius.md') as Token)});`);

  // Fyldo-only extras that components use directly
  root.push('  /* Focus (neutral, never blue) */');
  root.push(`  --fyldo-focus-ring-color: ${reference('focus.ring-neutral')};`);
  root.push(`  --fyldo-focus-border-color: ${reference('focus.border')};`);

  out.push(`${opts.rootSelector} {\n${root.join('\n')}\n}\n`);
  out.push(`${opts.rootSelector}[dir='rtl'] {\n${rtl.join('\n')}\n}\n`);

  // ── @theme inline (utilities) ────────────────────────────────────────────────────────────────────────
  const theme: string[] = [
    '  /* Only Fyldo tokens exist as utilities: drop Tailwind defaults so raw palettes/sizes cannot be used. */',
    '  --color-*: initial;',
    '  --font-*: initial;',
    '  --radius-*: initial;',
    '  --shadow-*: initial;',
    '  --inset-shadow-*: initial;',
    '  --drop-shadow-*: initial;',
    '  --text-*: initial;',
    '  --tracking-*: initial;',
    '  --blur-*: initial;',
    '  --spacing: 4px;',
    '  --font-sans: var(--fyldo-font-family);',
    '  --font-mono: var(--fyldo-font-family-mono);',
  ];
  theme.push('  --color-white: var(--fyldo-white);', '  --color-transparent: transparent;', '  --color-current: currentColor;');
  for (const t of where('color.')) theme.push(`  --color-${t.name.slice('color.'.length).replace(/\./g, '-')}: var(${cssName(t)});`);
  for (const name of Object.keys(SHADCN_MAP)) theme.push(`  --color-${name}: var(--${name});`);
  for (const t of where('spacing.radius.')) {
    const key = t.name.slice('spacing.radius.'.length);
    theme.push(`  --radius-${key}: var(${cssName(t)});`);
  }
  for (const e of effects) theme.push(`  --shadow-${effectVar(e.name).slice('--fyldo-shadow-'.length)}: var(${effectVar(e.name)});`);
  out.push(`@theme inline {\n${theme.join('\n')}\n}\n`);

  // ── text-style utilities ─────────────────────────────────────────────────────────────────────────────
  for (const s of en) {
    const key = styleKey(s.name);
    const family = s.family.includes('Mono') ? 'var(--fyldo-font-family-mono)' : 'var(--fyldo-font-family)';
    out.push(
      `@utility ${utilityName(key)} {\n` +
        `  font-family: ${family};\n` +
        `  font-weight: ${FONT_WEIGHTS[s.style]};\n` +
        `  font-size: ${px(s.size)};\n` +
        `  line-height: var(${textVar('leading', key)});\n` +
        `  letter-spacing: var(${textVar('tracking', key)});\n` +
        `}\n`,
    );
  }

  const hash = createHash('sha256').update(JSON.stringify([snapshot, styles, opts])).digest('hex').slice(0, 12);
  const header =
    `/* AUTO-GENERATED by tools/tokens/build.ts — DO NOT EDIT.\n` +
    ` * Source: tokens/figma.tokens.json + tokens/figma.styles.json (Figma file ${snapshot.source.fileKey}).\n` +
    ` * source-hash: ${hash}${warnings.length ? '\n * WARNINGS:\n' + warnings.map((w) => ` *   - ${w}`).join('\n') : ''}\n */\n\n`;

  return { css: header + out.join('\n'), warnings };
}
