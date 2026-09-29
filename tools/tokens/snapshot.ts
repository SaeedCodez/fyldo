/**
 * Normalises the raw Figma exports (written by the figma-console MCP) into the committed snapshots:
 *
 *   tokens/.raw/all.tokens.json  ← figma_export_tokens (format "dtcg", colorFormat "hex8")
 *   tokens/.raw/styles.json      ← figma_execute tools/figma/extract-styles.js
 *   ───────────────────────────────────────────────
 *   tokens/figma.tokens.json     deterministic, timestamp-free, flat, sorted
 *   tokens/figma.styles.json     text + effect styles, rounded
 *
 * Usage: npm run tokens:snapshot
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export type TokenType = 'color' | 'dimension' | 'fontFamily' | 'string';

export interface Token {
  /** Dotted DTCG path, e.g. `color.action.primary`, `primitives.color.gray.1000`, `spacing.space.8`. */
  name: string;
  type: TokenType;
  /** Literal (`#rrggbb[aa]`, number, string) or alias `{path}`. */
  value: string | number;
  description?: string;
  /** Custom property name from the Figma variable's WEB code syntax, e.g. `--fyldo-action-primary`. */
  css?: string;
}

export interface TokenSnapshot {
  source: { fileKey: string; fileName: string };
  tokens: Token[];
}

export interface TextStyle {
  name: string;
  family: string;
  style: string;
  size: number;
  /** px; null = auto */
  lineHeight: number | null;
  /** px */
  letterSpacing: number;
}

export interface EffectLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  /** `#rrggbb` or `#rrggbbaa` */
  color: string;
}

export interface EffectStyle {
  name: string;
  layers: EffectLayer[];
}

export interface StyleSnapshot {
  textStyles: TextStyle[];
  effectStyles: EffectStyle[];
}

interface RawToken {
  $type?: string;
  $value?: unknown;
  $description?: string;
  $extensions?: { 'figma-console-mcp'?: { codeSyntax?: { WEB?: string } } };
}

/** `#RRGGBBAA` (any case) → lower-case `#rrggbb`, keeping the alpha byte only when it is not fully opaque. */
export function normalizeHex(hex: string): string {
  const h = hex.toLowerCase();
  return h.length === 9 && h.endsWith('ff') ? h.slice(0, 7) : h;
}

function* walk(node: Record<string, unknown>, path: string[] = []): Generator<[string, RawToken]> {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$') || typeof value !== 'object' || value === null) continue;
    const child = value as Record<string, unknown>;
    if ('$value' in child) yield [[...path, key].join('.'), child as RawToken];
    else yield* walk(child, [...path, key]);
  }
}

export function normalizeVariables(raw: Record<string, unknown>): TokenSnapshot {
  const ext = (raw.$extensions as Record<string, { figmaFileKey?: string }> | undefined)?.['figma-console-mcp'];
  const tokens: Token[] = [];

  for (const [name, token] of walk(raw)) {
    const type = token.$type as TokenType;
    let value = token.$value as string | number;
    if (typeof value === 'string' && value.startsWith('#')) value = normalizeHex(value);

    const css = token.$extensions?.['figma-console-mcp']?.codeSyntax?.WEB?.match(/^var\((--[\w-]+)\)$/)?.[1];
    const entry: Token = { name, type, value };
    if (token.$description) entry.description = token.$description;
    if (css) entry.css = css;
    tokens.push(entry);
  }

  tokens.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  return { source: { fileKey: ext?.figmaFileKey ?? '', fileName: 'Fyldo' }, tokens };
}

const round = (n: number) => Math.round(n * 100) / 100;

export function normalizeStyles(raw: {
  textStyles: Array<{
    name: string;
    family: string;
    style: string;
    size: number;
    lineHeight: { unit: string; value?: number };
    letterSpacing: { unit: string; value: number };
  }>;
  effectStyles: Array<{
    name: string;
    effects: Array<{ x: number; y: number; blur: number; spread: number; color: string | null }>;
  }>;
}): StyleSnapshot {
  return {
    textStyles: raw.textStyles.map((s) => ({
      name: s.name,
      family: s.family,
      style: s.style,
      size: s.size,
      lineHeight: s.lineHeight.unit === 'PIXELS' && s.lineHeight.value !== undefined ? round(s.lineHeight.value) : null,
      letterSpacing: s.letterSpacing.unit === 'PIXELS' ? round(s.letterSpacing.value) : 0,
    })),
    effectStyles: raw.effectStyles.map((s) => ({
      name: s.name,
      layers: s.effects
        .filter((e) => e.color)
        .map((e) => ({ x: e.x, y: e.y, blur: e.blur, spread: e.spread, color: normalizeHex(e.color as string) })),
    })),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const variables = JSON.parse(readFileSync(resolve(root, 'tokens/.raw/all.tokens.json'), 'utf8'));
  const styles = JSON.parse(readFileSync(resolve(root, 'tokens/.raw/styles.json'), 'utf8'));

  const snapshot = normalizeVariables(variables);
  writeFileSync(resolve(root, 'tokens/figma.tokens.json'), JSON.stringify(snapshot, null, 2) + '\n');
  writeFileSync(resolve(root, 'tokens/figma.styles.json'), JSON.stringify(normalizeStyles(styles), null, 2) + '\n');
  console.log(`tokens: ${snapshot.tokens.length} variables, styles snapshot written.`);
}
