/**
 * Reader for the Figma reference pack (design/figma, see design/figma/README.md). Parity tests take EVERY expected
 * geometry, padding, radius, gap, text style and token binding from these files — nothing is copied by hand.
 *
 * Token colours are resolved from tokens/figma.tokens.json (support/figma.ts `token()`), as the README prescribes.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHex } from '../../../tools/tokens/color.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const PACK_DIR = resolve(here, '../../../design/figma');

export interface Paint {
  type: string;
  hex: string;
  token?: string;
  opacity?: number;
}

export interface Node {
  name: string;
  type: string;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  layout?: {
    layoutMode?: 'HORIZONTAL' | 'VERTICAL';
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    itemSpacing?: number;
    counterAxisAlignItems?: string;
    primaryAxisAlignItems?: string;
  };
  cornerRadius?: number;
  fills?: Paint[];
  strokes?: { paints: Paint[]; weight: number; align: string };
  effects?: { style?: string; values: Array<{ hex: string; opacity: number; offset: { x: number; y: number }; radius: number; spread: number }> };
  text?: {
    characters: string;
    textStyle: string;
    fontSize: number;
    fontStyle: string;
    lineHeight: { unit: string; value: number };
    letterSpacing: { unit: string; value: number };
    fillToken?: string;
  };
  /** An Iconsax instance (not walked further). */
  icon?: { name: string; size: number; variant: string; colour: string };
  children?: Node[];
}

export interface Variant {
  id: string;
  name: string;
  file: string;
  variantProperties: Record<string, string>;
  node: Node;
}

const cache = new Map<string, Variant[]>();

function variants(set: string): Variant[] {
  let list = cache.get(set);
  if (!list) {
    list = (JSON.parse(readFileSync(resolve(PACK_DIR, 'components', `${set}.json`), 'utf8')) as { variants: Variant[] }).variants;
    cache.set(set, list);
  }
  return list;
}

/** The one variant whose properties include all of `props` (e.g. `{ Locale: 'EN', State: 'Focus' }`). */
export function variant(set: string, props: Record<string, string>): Variant {
  const found = variants(set).filter((v) => Object.entries(props).every(([k, val]) => v.variantProperties[k] === val));
  if (found.length !== 1) throw new Error(`${set}: ${found.length} variants match ${JSON.stringify(props)}`);
  return found[0] as Variant;
}

/** Every variant of a set that matches `props` (used to enumerate the states a test covers). */
export const allVariants = (set: string, props: Record<string, string> = {}): Variant[] =>
  variants(set).filter((v) => Object.entries(props).every(([k, val]) => v.variantProperties[k] === val));

/** Descendant lookup by a chain of layer names: `layer(root, 'Control', 'Placeholder')`. Throws when missing. */
export function layer(root: Node, ...names: string[]): Node {
  let current = root;
  for (const name of names) {
    const hit = search(current, name);
    if (!hit) throw new Error(`layer "${name}" not found under "${current.name}"`);
    current = hit;
  }
  return current;
}

function search(node: Node, name: string): Node | undefined {
  for (const child of node.children ?? []) {
    if (child.name === name) return child;
  }
  for (const child of node.children ?? []) {
    const hit = search(child, name);
    if (hit) return hit;
  }
  return undefined;
}

export const has = (root: Node, name: string): boolean => search(root, name) !== undefined;

/** Layers that Figma hides through a boolean component property ("Show description" = false). */
export const shown = (root: Node, name: string): boolean => {
  const hit = search(root, name);
  return hit !== undefined && hit.visible;
};

export const paddings = (n: Node): [number, number, number, number] => [n.layout?.paddingTop ?? 0, n.layout?.paddingRight ?? 0, n.layout?.paddingBottom ?? 0, n.layout?.paddingLeft ?? 0];
export const gap = (n: Node): number => n.layout?.itemSpacing ?? 0;
export const fillToken = (n: Node): string | null => n.fills?.[0]?.token ?? null;
export const strokeToken = (n: Node): string | null => n.strokes?.paints[0]?.token ?? null;
export const strokeWeight = (n: Node): number => n.strokes?.weight ?? 0;

const WEIGHTS: Record<string, number> = { Regular: 400, Medium: 500, SemiBold: 600, DemiBold: 600, Bold: 700 };

/** CSS values (as `getComputedStyle` prints them) of a TEXT layer's style. */
export function textCss(n: Node): { fontSize: string; fontWeight: string; lineHeight: string; color: string | null } {
  const t = n.text;
  if (!t) throw new Error(`"${n.name}" is not a text layer`);
  return { fontSize: `${t.fontSize}px`, fontWeight: String(WEIGHTS[t.fontStyle] ?? 400), lineHeight: `${t.lineHeight.value}px`, color: t.fillToken ?? null };
}

/** Effect layers as the normalised strings `shadows()` (support/figma.ts) yields: `r,g,b,a Xpx Ypx Blurpx Spreadpx`. */
export function effectLayers(n: Node): string[] {
  return (n.effects?.values ?? []).map((v) => {
    const c = parseHex(v.hex);
    return `${c.r},${c.g},${c.b},${Math.round(v.opacity * 100) / 100} ${v.offset.x}px ${v.offset.y}px ${v.radius}px ${v.spread}px`;
  });
}

/** Integer digits of a string in ASCII, Persian (۰–۹) or Arabic-Indic (٠–٩) numerals. */
export const digits = (s: string): number[] =>
  (s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).match(/\d+/g) ?? []).map(Number);

/** Width × height in pixels of a PNG (IHDR), without decoding it. */
export function pngSize(buffer: Buffer): { width: number; height: number } {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/** Path of the pack's PNG for a variant (`png/<set>/<variant file>.png`). */
export function pngPath(set: string, v: Variant): string {
  const path = resolve(PACK_DIR, 'png', set, `${v.file}.png`);
  if (!existsSync(path)) throw new Error(`missing ${path}`);
  return path;
}
