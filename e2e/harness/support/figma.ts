import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Locator, Page } from '@playwright/test';
import { parseHex } from '../../../tools/tokens/color.ts';
import { resolveColor } from '../../../tools/tokens/generate.ts';
import type { TokenSnapshot } from '../../../tools/tokens/snapshot.ts';

const here = dirname(fileURLToPath(import.meta.url));
const snapshot: TokenSnapshot = JSON.parse(readFileSync(resolve(here, '../../../tokens/figma.tokens.json'), 'utf8'));

/** Resolved Figma colour of a semantic token, as the browser prints it (`rgb(…)` / `rgba(…)`). */
export function token(name: string): string {
  return css(resolveColor(snapshot, `color.${name.replace(/\//g, '.')}`));
}

export function css(hex: string): string {
  const c = parseHex(hex);
  return c.a < 1 ? `rgba(${c.r}, ${c.g}, ${c.b}, ${Number(c.a.toFixed(3))})` : `rgb(${c.r}, ${c.g}, ${c.b})`;
}

export const TRANSPARENT = 'rgba(0, 0, 0, 0)';

export async function open(page: Page, params: Record<string, string>): Promise<Locator> {
  const query = new URLSearchParams(params).toString();
  await page.goto(`/e2e/.generated/gallery/index.html?${query}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  const stage = page.locator('[data-variant-root]');
  await stage.waitFor();
  // Web fonts and the first layout must be final before anything is measured or screenshotted.
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
  return stage;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  if (!b) throw new Error('element has no box');
  return b;
}

/** Computed styles, read after two animation frames so a hover/focus/open change has been applied. */
export const style = (locator: Locator, props: string[]): Promise<Record<string, string>> =>
  locator.evaluate(
    (el, list) =>
      new Promise<Record<string, string>>((done) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const cs = getComputedStyle(el);
            done(Object.fromEntries(list.map((p) => [p, cs.getPropertyValue(p)])));
          }),
        ),
      ),
    props,
  );

/** Effective shadow layers of a computed `box-shadow`: Tailwind's transparent placeholders dropped, alpha rounded to 2 decimals. */
export function shadows(computed: string): string[] {
  const layers = computed.match(/rgba?\([^)]*\)\s+-?[\d.]+px\s+-?[\d.]+px\s+-?[\d.]+px\s+-?[\d.]+px/g) ?? [];
  return layers
    .map((layer) => {
      const m = /rgba?\(([^)]*)\)\s+(.*)/.exec(layer) as RegExpExecArray;
      const [r, g, b, a = '1'] = (m[1] as string).split(',').map((p) => p.trim());
      return { color: `${r},${g},${b},${Math.round(Number(a) * 100) / 100}`, geometry: m[2] as string };
    })
    .filter((l) => !(l.color.endsWith(',0') && /^0px 0px 0px 0px$/.test(l.geometry)))
    .map((l) => `${l.color} ${l.geometry}`);
}

/** The same normalisation for an expected `[x, y, blur, spread, #hex]` layer. */
export function shadow(hex: string, x: number, y: number, blur: number, spread: number): string {
  const c = parseHex(hex);
  return `${c.r},${c.g},${c.b},${Math.round(c.a * 100) / 100} ${x}px ${y}px ${blur}px ${spread}px`;
}
