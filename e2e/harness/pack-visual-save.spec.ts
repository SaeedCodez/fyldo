/**
 * M3 part 2 — one pixel test per component, default variant, EN + FA, against the pack PNGs (design/figma/png, 2x):
 * the Save Bar (State=Dirty) and the Modal (Type=Default: the unsaved-changes dialog).
 *
 * The PNGs include the drop shadow around the component, so the component's own box is located in the PNG (its
 * opaque pixels) and compared with our element's box. EN compares the whole component (Geist in both). FA is
 * IRANYekanX in Figma and Vazirmatn in code (docs/design-spec.md D11): it compares the text-free parts and checks the
 * mirrored geometry. Texts and positions come from design/figma/components/*.json.
 */
import { readFileSync } from 'node:fs';
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { PNG } from 'pngjs';
import { box, open } from './support/figma';
import { layer, pngPath, variant, type Node } from './support/pack';
import { comparePixels, type Rect } from './support/pixels';
import { instances, label, type Locale } from './support/shell';

const SCALE = 2;
const PAD = 4;
const dir = (locale: Locale) => (locale === 'FA' ? 'rtl' : 'ltr');

async function newPage(browser: Browser) {
  const context = await browser.newContext({
    deviceScaleFactor: SCALE,
    reducedMotion: 'reduce',
    viewport: { width: 1200, height: 800 },
  });
  return { page: await context.newPage(), close: () => context.close() };
}

/** Where the component itself (its fully opaque pixels) sits in a pack PNG that also holds its shadow, in CSS px. */
function componentIn(set: string, props: Record<string, string>): Rect {
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
  return {
    x: x0 / SCALE,
    y: y0 / SCALE,
    width: (x1 + 1 - x0) / SCALE,
    height: (y1 + 1 - y0) / SCALE,
  };
}

/** Our element's box relative to the stage. */
async function relative(stage: Locator, target: Locator): Promise<Rect> {
  const s = await box(stage);
  const b = await box(target);
  return { x: b.x - s.x, y: b.y - s.y, width: b.width, height: b.height };
}

/** A pack node (relative to the component root) → a region of the PNG / of our element, grown by PAD. */
const at = (origin: Rect, n: Pick<Node, 'x' | 'y' | 'width' | 'height'>, pad = PAD): Rect => ({
  x: origin.x + n.x - pad,
  y: origin.y + n.y - pad,
  width: n.width + pad * 2,
  height: n.height + pad * 2,
});

interface Compare {
  page: Page;
  testInfo: TestInfo;
  stage: Locator;
  set: string;
  props: Record<string, string>;
  region: Rect;
  actual: Rect;
  max?: number;
}

const compare = async (c: Compare) => {
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
  console.log(
    `${c.set} ${JSON.stringify(c.props)} @${c.region.x},${c.region.y}: ${(result.ratio * 100).toFixed(2)}% differ`,
  );
};

// ── Save Bar (State=Dirty) ────────────────────────────────────────────────────────────────────────────────────
for (const locale of ['EN', 'FA'] as const) {
  test(`Save Bar ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Locale: locale, State: 'Dirty' };
    const root = variant('save-bar', props).node;
    const ref = componentIn('save-bar', props);
    expect([ref.width, ref.height]).toEqual([root.width, root.height]);
    const { page, close } = await newPage(browser);
    const stage = await open(page, { c: 'save-bar', dir: dir(locale), state: 'dirty' });
    const bar = stage.locator('[data-slot=fy-save-bar]');
    const ours = await relative(stage, bar);
    expect([ours.width, ours.height]).toEqual([root.width, root.height]);

    if (locale === 'EN') {
      await compare({ page, testInfo, stage, set: 'save-bar', props, region: ref, actual: ours });
    } else {
      // the 8px dot at the inline start (right), and the buttons' row at the inline end (left)
      const indicator = layer(root, 'Status', 'Indicator');
      await compare({
        page,
        testInfo,
        stage,
        set: 'save-bar',
        props,
        region: at(ref, indicator),
        actual: at(ours, indicator),
        max: 0.03,
      });
      const actions = layer(root, 'Actions');
      const ourActions = await relative(stage, bar.locator('button').first().locator('..'));
      expect(Math.round(ourActions.x - ours.x), 'the actions start 12px from the left edge').toBe(
        actions.x,
      );
    }
    await close();
  });
}

// ── Modal (Type=Default: "Discard unsaved changes?") ─────────────────────────────────────────────────────────────
for (const locale of ['EN', 'FA'] as const) {
  test(`Modal ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Locale: locale, Type: 'Default' };
    const root = variant('modal', props).node;
    const ref = componentIn('modal', props);
    expect([ref.width, ref.height]).toEqual([root.width, root.height]);
    const footer = layer(root, 'Footer');
    const button = (name: string) =>
      instances(footer, 'Button').find((n) => n.name === name) as Node;
    const { page, close } = await newPage(browser);
    const stage = await open(page, {
      c: 'modal',
      dir: dir(locale),
      title: layer(root, 'Title').text?.characters ?? '',
      description: layer(root, 'Description').text?.characters ?? '',
      cancel: label(button('Cancel'), locale),
      confirm: label(button('Confirm'), locale),
    });
    const modal = page.locator('[data-slot=fy-modal]');
    await expect(modal).toBeVisible();
    await page.mouse.move(0, 0);
    // the focus ring on Cancel (initial focus) is not in the pack: take it off for the picture
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const ours = await relative(stage, modal);
    expect([ours.width, Math.round(ours.height)]).toEqual([root.width, root.height]);

    // Cancel at the inline start, Confirm at the inline end (mirrored in FA)
    const cancel = await relative(
      stage,
      modal.getByRole('button', { name: label(button('Cancel'), locale) }),
    );
    // (its inline-start edge: the FA label is set in another font, so its width differs)
    const packCancel = button('Cancel');
    if (locale === 'EN') expect(Math.round(cancel.x - ours.x)).toBe(Math.round(packCancel.x));
    else expect(Math.round(cancel.x + cancel.width - ours.x)).toBe(Math.round(packCancel.x + packCancel.width));

    if (locale === 'EN') {
      await compare({ page, testInfo, stage, set: 'modal', props, region: ref, actual: ours });
    } else {
      // the close button (text-free), at the inline end of the header = its left side in RTL
      const closeButton = layer(root, 'Header', 'Close');
      await compare({
        page,
        testInfo,
        stage,
        set: 'modal',
        props,
        region: at(ref, closeButton),
        actual: at(ours, closeButton),
        max: 0.03,
      });
    }
    await close();
  });
}
