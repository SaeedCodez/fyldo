/**
 * Shared bits of the per-component pixel tests (design/figma/png at deviceScaleFactor 2): a browser page at the pack's
 * scale, where a component sits inside its PNG (the export includes its drop shadow), and pack-node → region maths.
 */
import { readFileSync } from 'node:fs';
import { expect, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test';
import { PNG } from 'pngjs';
import { box } from './figma';
import { pngPath, variant, type Node } from './pack';
import { comparePixels, type Rect } from './pixels';

export const SCALE = 2;
export const PAD = 4;
export const dirOf = (locale: 'EN' | 'FA') => (locale === 'FA' ? 'rtl' : 'ltr');

export async function newPage(browser: Browser) {
  const context = await browser.newContext({ deviceScaleFactor: SCALE, reducedMotion: 'reduce', viewport: { width: 1200, height: 800 } });
  return { page: await context.newPage(), close: () => context.close() };
}

/** Where the component itself (its fully opaque pixels) sits in a pack PNG that also holds its shadow, in CSS px. */
export function componentIn(set: string, props: Record<string, string>): Rect {
  const png = PNG.sync.read(readFileSync(pngPath(set, variant(set, props))));
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++)
      if (png.data[(y * png.width + x) * 4 + 3] === 255) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  return { x: x0 / SCALE, y: y0 / SCALE, width: (x1 + 1 - x0) / SCALE, height: (y1 + 1 - y0) / SCALE };
}

/** The whole PNG (a component whose export is exactly its bounds, e.g. the Tooltip), in CSS px from its top-left. */
export function wholePng(set: string, props: Record<string, string>): Rect {
  const png = PNG.sync.read(readFileSync(pngPath(set, variant(set, props))));
  return { x: 0, y: 0, width: png.width / SCALE, height: png.height / SCALE };
}

/** Our element's box relative to the stage. */
export async function relative(stage: Locator, target: Locator): Promise<Rect> {
  const s = await box(stage);
  const b = await box(target);
  return { x: b.x - s.x, y: b.y - s.y, width: b.width, height: b.height };
}

/** A pack node (relative to the component root) → a region of the PNG / of our element, grown by `pad`. */
export const at = (origin: Rect, n: Pick<Node, 'x' | 'y' | 'width' | 'height'>, pad = PAD): Rect => ({
  x: origin.x + n.x - pad,
  y: origin.y + n.y - pad,
  width: n.width + pad * 2,
  height: n.height + pad * 2,
});

export interface Compare {
  page: Page;
  testInfo: TestInfo;
  stage: Locator;
  set: string;
  props: Record<string, string>;
  region: Rect;
  actual: Rect;
  max?: number;
}

export async function compare(c: Compare): Promise<void> {
  const result = await comparePixels({
    page: c.page,
    testInfo: c.testInfo,
    reference: pngPath(c.set, variant(c.set, c.props)),
    scale: SCALE,
    stage: c.stage,
    referenceRegion: c.region,
    actualRegion: c.actual,
    maxDiffRatio: c.max ?? 0.08, // text anti-aliasing and hinting differ between Figma and Chrome
  });
  console.log(`${c.set} ${JSON.stringify(c.props)} @${c.region.x},${c.region.y}: ${(result.ratio * 100).toFixed(2)}% differ`);
}

export const size = (r: Rect): [number, number] => [r.width, r.height];
export { expect };
