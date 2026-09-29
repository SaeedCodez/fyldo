/**
 * Pixel comparison of Tag, Multi Select and the Select Menu (Multi) against the Figma pack (design/figma/png), at
 * deviceScaleFactor 2 — the scale the component PNGs were exported at.
 *
 * Fonts: EN is Geist in Figma and in code, so the whole component is compared. FA is IRANYekanX in Figma and Vazirmatn in
 * code (docs/design-spec.md D11) — glyph shapes differ by design — so FA compares the text-free part (the chevron column, the
 * remove button, the checkbox column) and the layout is asserted in pack-parity-multi-select.spec.ts.
 *
 * A coarse guard by nature (anti-aliasing and hinting differ between Figma and Chrome): a small share of differing pixels is
 * allowed; failures attach actual / expected / diff. The pack's PNGs are read-only.
 */
import { readFileSync } from 'node:fs';
import { test, type Browser, type Page } from '@playwright/test';
import { box, open } from './support/figma';
import { LOCALES, openMenu, paramsFor, SIZES, STATES } from './support/multi-select';
import { layer, pngPath, pngSize, variant, type Node } from './support/pack';
import { comparePixels, type Rect } from './support/pixels';

const SCALE = 2;

async function newPage(browser: Browser) {
  const context = await browser.newContext({ deviceScaleFactor: SCALE, reducedMotion: 'reduce' });
  return { page: await context.newPage(), close: () => context.close() };
}

/** Freeze what moves (caret) so a screenshot is stable. */
const still = (page: Page) => page.addStyleTag({ content: '*{caret-color:transparent !important}' });
const whole = (file: string): Rect => {
  const size = pngSize(readFileSync(file));
  return { x: 0, y: 0, width: size.width / SCALE, height: size.height / SCALE };
};

/**
 * Figma exports a component with its drop shadows, so the popup's PNG is larger than the popup: this is how far the shadow
 * reaches on each side (blur + spread, moved by the offset), read from the node's own effects.
 */
function shadowMargin(n: Node): { left: number; top: number } {
  const reach = (side: (v: { offset: { x: number; y: number } }) => number) =>
    Math.max(0, ...(n.effects?.values ?? []).map((v) => Math.ceil(v.radius + v.spread - side(v))));
  return { left: reach((v) => -Math.abs(v.offset.x)), top: reach((v) => v.offset.y) };
}

// ── Tag ────────────────────────────────────────────────────────────────────────────────────────────────
for (const locale of LOCALES) {
  for (const size of ['Small', 'Medium'] as const) {
    for (const state of ['Default', 'Hover', 'Disabled'] as const) {
      test(`Tag ${locale.name} · ${size} · ${state}`, async ({ browser }, testInfo) => {
        const v = variant('tag', { Locale: locale.name, Size: size, State: state });
        const remove = layer(v.node, 'Remove');
        const { page, close } = await newPage(browser);
        const stage = await open(page, {
          c: 'tag',
          dir: locale.dir,
          size: size === 'Small' ? 'sm' : 'md',
          state: state === 'Disabled' ? 'disabled' : 'default',
          label: layer(v.node, 'Label').text?.characters ?? '',
        });
        await still(page);
        if (state === 'Hover') await stage.locator('[data-slot=fy-tag]').hover();
        const reference = pngPath('tag', v);
        if (locale.name === 'EN') {
          // (a 20px-tall tag is ~4,700 device pixels: one pixel of text shift is several percent)
          await comparePixels({ page, testInfo, reference, scale: SCALE, stage, referenceRegion: whole(reference), maxDiffRatio: 0.12 });
        } else {
          // FA: the remove button and the stroke at the end edge (left in RTL) — text is set in a different font
          const region: Rect = { x: 0, y: 0, width: remove.x + remove.width + 4, height: v.node.height };
          await comparePixels({ page, testInfo, reference, scale: SCALE, stage, referenceRegion: region, maxDiffRatio: 0.04 });
        }
        await close();
      });
    }
  }
}

// ── Multi Select field ─────────────────────────────────────────────────────────────────────────────────
for (const locale of LOCALES) {
  for (const size of SIZES) {
    for (const state of STATES) {
      test(`Multi Select ${locale.name} · ${size.name} · ${state}`, async ({ browser }, testInfo) => {
        const v = variant('multi-select', { Locale: locale.name, Size: size.name, State: state });
        const root = v.node;
        const control = layer(root, 'Control');
        const { page, close } = await newPage(browser);
        const stage = await open(page, paramsFor(locale, root, size.code, state));
        await still(page);
        const field = stage.getByRole('combobox');
        if (state === 'Hover') await field.hover();
        if (state === 'Focus') await page.keyboard.press('Tab');
        if (state === 'Open') {
          await field.click();
          await page.locator('[data-slot=fy-multi-select-menu]').waitFor();
          await page.mouse.move(0, 0);
        }
        const reference = pngPath('multi-select', v);
        // Open: the popup sits over the helper row, which Figma's Open frame still shows — compare label + control only.
        const top = state === 'Open' ? control.y + control.height : root.height;
        if (locale.name === 'EN') {
          const region: Rect = { x: 0, y: 0, width: root.width, height: top };
          await comparePixels({ page, testInfo, reference, scale: SCALE, stage, referenceRegion: region, maxDiffRatio: 0.08 });
        } else {
          // FA: the chevron column (text-free) over the whole control height
          const chevron = layer(layer(control, 'Icons'), 'Chevron');
          const region: Rect = { x: chevron.x - 4, y: control.y, width: chevron.width + 8, height: control.height };
          const at = await box(field);
          const s = await box(stage);
          await comparePixels({
            page,
            testInfo,
            reference,
            scale: SCALE,
            stage,
            referenceRegion: region,
            actualRegion: { x: region.x, y: at.y - s.y, width: region.width, height: region.height },
            maxDiffRatio: 0.05,
          });
        }
        await close();
      });
    }
  }
}

// ── Select Menu · Multi (Search, six Menu Items, Footer with Clear) ────────────────────────────────────
for (const locale of LOCALES) {
  test(`Select Menu Multi ${locale.name}`, async ({ browser }, testInfo) => {
    const v = variant('select-menu', { Locale: locale.name, Type: 'Multi' });
    const root = v.node;
    const { page, close } = await newPage(browser);
    const { stage, popup } = await openMenu(page, locale, root, {});
    await still(page);
    await page.locator('[role=option]').nth(4).hover(); // Item 5 is drawn in its Hover state
    const reference = pngPath('select-menu', v);
    const p = await box(popup);
    const s = await box(stage);
    const at = { x: p.x - s.x, y: p.y - s.y };
    // the PNG includes the drop shadow around the popup: the popup itself starts `margin` in
    const margin = shadowMargin(root);
    const popupInPng: Rect = { x: margin.left, y: margin.top, width: root.width, height: root.height };
    if (locale.name === 'EN') {
      const whole = await comparePixels({ page, testInfo, reference, scale: SCALE, stage, referenceRegion: popupInPng, actualRegion: { ...at, width: root.width, height: root.height }, maxDiffRatio: 0.03 }); // measured 0.3 %
      console.log(`Select Menu Multi EN: ${(whole.ratio * 100).toFixed(2)}% differ`);
    }
    // Both locales: the checkbox column of the six rows (text-free): checked ×4, Hover, Disabled
    const options = layer(root, 'Options');
    const item = layer(root, 'Item 1');
    const boxX = locale.name === 'EN' ? item.x + 8 : root.width - (item.x + 8 + 16);
    const strip: Rect = { x: boxX - 2, y: options.y, width: 20, height: options.height };
    await comparePixels({
      page,
      testInfo,
      reference,
      scale: SCALE,
      stage,
      referenceRegion: { ...strip, x: strip.x + margin.left, y: strip.y + margin.top },
      actualRegion: { x: at.x + strip.x, y: at.y + strip.y, width: strip.width, height: strip.height },
      maxDiffRatio: 0.04,
    });
    await close();
  });
}
