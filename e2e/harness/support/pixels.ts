/**
 * Pixel comparison against the Figma reference pack (design/figma/png). The pack is read-only: unlike
 * `toHaveScreenshot`, nothing here can ever write a reference; failures attach actual / expected / diff instead.
 *
 * A Figma export is the component's tight bounding box on a transparent background; pixelmatch is flattened over white,
 * which is the page background of the gallery.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompareOptions {
  page: Page;
  testInfo: TestInfo;
  /** Reference PNG (design/figma/png/…). */
  reference: string;
  /** Device pixels per CSS pixel of the reference (2 for component PNGs, 1 for usage frames). Must equal the page's deviceScaleFactor. */
  scale: number;
  /** The gallery's `[data-variant-root]` (its top-left is the component's top-left). */
  stage: Locator;
  /** Compare only this region of the reference, in CSS px from the component's top-left (default: all of it). */
  referenceRegion?: Rect;
  /** Where the same region lives on our page, in CSS px from the stage's top-left (default: the same place). */
  actualRegion?: Rect;
  /** Share of pixels allowed to differ. */
  maxDiffRatio: number;
  /** pixelmatch colour distance (0–1): how different two pixels must be to count. */
  threshold?: number;
}

export interface Comparison {
  differing: number;
  total: number;
  ratio: number;
}

/** Composite over white in place (a Figma export is transparent outside the component; the gallery page is white). */
function flatten(png: PNG): PNG {
  for (let i = 0; i < png.data.length; i += 4) {
    const a = (png.data[i + 3] as number) / 255;
    for (let c = 0; c < 3; c++) png.data[i + c] = Math.round(255 + ((png.data[i + c] as number) - 255) * a);
    png.data[i + 3] = 255;
  }
  return png;
}

export async function comparePixels(o: CompareOptions): Promise<Comparison> {
  const ref = PNG.sync.read(readFileSync(o.reference));
  const region = o.referenceRegion ?? { x: 0, y: 0, width: ref.width / o.scale, height: ref.height / o.scale };
  const at = o.actualRegion ?? region;
  const w = Math.round(region.width * o.scale);
  const h = Math.round(region.height * o.scale);

  // crop the reference
  const expected = new PNG({ width: w, height: h });
  flatten(ref);
  PNG.bitblt(ref, expected, Math.round(region.x * o.scale), Math.round(region.y * o.scale), w, h, 0, 0);

  const stageBox = await o.stage.boundingBox();
  if (!stageBox) throw new Error('the stage has no box');
  const shot = await o.page.screenshot({ clip: { x: stageBox.x + at.x, y: stageBox.y + at.y, width: region.width, height: region.height }, scale: 'device' });
  const actual = flatten(PNG.sync.read(shot));
  expect([actual.width, actual.height], 'screenshot size (device px)').toEqual([w, h]);

  const diff = new PNG({ width: w, height: h });
  const differing = pixelmatch(actual.data, expected.data, diff.data, w, h, { threshold: o.threshold ?? 0.3 });
  const result = { differing, total: w * h, ratio: differing / (w * h) };

  const name = o.reference.replace(/^.*design\/figma\/png\//, '').replace(/[\\/]/g, '-');
  if (result.ratio > o.maxDiffRatio) {
    for (const [suffix, png] of [['actual', actual], ['expected', expected], ['diff', diff]] as const) {
      const path = o.testInfo.outputPath(`${name.replace(/\.png$/, '')}-${suffix}.png`);
      writeFileSync(path, PNG.sync.write(png));
      await o.testInfo.attach(`${name}-${suffix}`, { path, contentType: 'image/png' });
    }
  }
  expect(result.ratio, `${differing}/${w * h} px differ (${(result.ratio * 100).toFixed(2)}%) in ${name}`).toBeLessThanOrEqual(o.maxDiffRatio);
  return result;
}
