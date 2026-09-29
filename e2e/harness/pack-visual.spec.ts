/**
 * Pixel comparison of the Milestone 2 components against the Figma pack (design/figma/png), at deviceScaleFactor 2 —
 * the scale the component PNGs were exported at. The usage-frame crops are 1x exports, so those run at 1.
 *
 * Fonts: EN is Geist in Figma and in code, so the whole component is compared. FA is IRANYekanX in Figma and Vazirmatn in
 * code (docs/design-spec.md D11) — glyph shapes differ by design — so FA compares the text-free part (the control glyph
 * / the control frame) and the layout is asserted in pack-parity.spec.ts.
 *
 * Coarse guard by nature (anti-aliasing and hinting differ between Figma and Chrome): a small share of differing pixels
 * is allowed; failures attach actual / expected / diff.
 */
import { readFileSync } from 'node:fs';
import { test, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test';
import { box, open } from './support/figma';
import { digits, layer, pngPath, pngSize, shown, variant, type Node } from './support/pack';
import { comparePixels, type Rect } from './support/pixels';

const SCALE = 2;
const pick = (v: { variantProperties: Record<string, string> }) => v.variantProperties;

async function newPage(browser: Browser, scale: number) {
  const context = await browser.newContext({ deviceScaleFactor: scale, reducedMotion: 'reduce' });
  return { page: await context.newPage(), close: () => context.close() };
}

/** Freeze what moves (caret, spinner) so a screenshot is stable. */
const still = (page: Page) => page.addStyleTag({ content: '*{caret-color:transparent !important}[data-fyldo-spinner]{animation:none !important}' });

const rect = (n: Node, parent: Node): Rect => ({ x: n.x - parent.x, y: n.y - parent.y, width: n.width, height: n.height });

// ── Textarea ───────────────────────────────────────────────────────────────────────────────────────────
for (const locale of ['EN', 'FA'] as const) {
  for (const state of ['Default', 'Hover', 'Focus', 'Filled', 'Error', 'Disabled'] as const) {
    test(`Textarea ${locale} · ${state}`, async ({ browser }, testInfo) => {
      const v = variant('textarea', { Locale: locale, State: state });
      const root = v.node;
      const control = layer(root, 'Control');
      const [count = 0, limit = 0] = digits(layer(root, 'Counter').text?.characters ?? '');
      const { page, close } = await newPage(browser, SCALE);
      const stage = await open(page, {
        c: 'textarea',
        dir: locale === 'FA' ? 'rtl' : 'ltr',
        state: state === 'Error' ? 'error' : state === 'Disabled' ? 'disabled' : 'default',
        label: layer(root, 'Label').text?.characters ?? '',
        placeholder: shown(control, 'Placeholder') ? (layer(control, 'Placeholder').text?.characters ?? '') : '',
        value: shown(control, 'Value') ? (layer(control, 'Value').text?.characters ?? '') : '',
        helper: shown(root, 'Helper text') ? (layer(root, 'Helper text').text?.characters ?? '') : '',
        error: shown(root, 'Error message') ? (layer(root, 'Error message').text?.characters ?? '') : '',
        count: String(count),
        limit: String(limit),
      });
      await still(page);
      if (state === 'Hover') await stage.locator('[data-slot=fy-textarea]').hover();
      if (state === 'Focus') await page.keyboard.press('Tab');
      await page.mouse.move(0, 0, { steps: 1 }).catch(() => undefined);
      if (state === 'Hover') await stage.locator('[data-slot=fy-textarea]').hover();
      const size = pngSize(readFileSync(pngPath('textarea', v)));
      // EN: the whole component (halo included: the reference is exactly the component's bounds).
      // FA: the control frame only — its placeholder/value text is set in a different font, everything else must match.
      const region: Rect | undefined = locale === 'FA' ? rect(control, root) : { x: 0, y: 0, width: size.width / SCALE, height: size.height / SCALE };
      await comparePixels({
        page,
        testInfo,
        reference: pngPath('textarea', v),
        scale: SCALE,
        stage,
        referenceRegion: region,
        actualRegion: locale === 'FA' ? { x: 0, y: (await box(stage.locator('[data-slot=fy-textarea]'))).y - (await box(stage)).y, width: region.width, height: region.height } : region,
        maxDiffRatio: 0.08, // text anti-aliasing / a 1px label width difference between Figma's Geist and Chrome's
      });
      await close();
    });
  }
}

// The 6×6 resize handle (native resizer repainted with tokens): its corner must match Figma's vector, both locales.
for (const locale of ['EN', 'FA'] as const) {
  for (const state of ['Default', 'Disabled'] as const) {
    test(`Textarea ${locale} · ${state}: resize handle corner`, async ({ browser }, testInfo) => {
      const v = variant('textarea', { Locale: locale, State: state });
      const root = v.node;
      const control = layer(root, 'Control');
      const handle = layer(control, 'Resize handle');
      const { page, close } = await newPage(browser, SCALE);
      const stage = await open(page, { c: 'textarea', dir: locale === 'FA' ? 'rtl' : 'ltr', state: state === 'Disabled' ? 'disabled' : 'default', label: 'x', helper: 'x' });
      await still(page);
      const pad = 3;
      const region: Rect = { x: handle.x - pad, y: handle.y - pad, width: handle.width + pad * 2, height: handle.height + pad * 2 };
      const wrapper = await box(stage.locator('[data-slot=fy-textarea]'));
      const s = await box(stage);
      // same corner on our side: measured from the control's own bottom edge, on the inline end (FA: mirrored to the left)
      const fromBottom = control.y + control.height - (handle.y + handle.height);
      const fromEnd = locale === 'EN' ? control.width - (handle.x + handle.width) : handle.x;
      const x = locale === 'EN' ? wrapper.x - s.x + wrapper.width - fromEnd - handle.width : wrapper.x - s.x + fromEnd;
      const y = wrapper.y - s.y + wrapper.height - fromBottom - handle.height;
      await comparePixels({
        page,
        testInfo,
        reference: pngPath('textarea', v),
        scale: SCALE,
        stage,
        referenceRegion: region,
        actualRegion: { x: x - pad, y: y - pad, width: region.width, height: region.height },
        maxDiffRatio: 0.03,
      });
      await close();
    });
  }
}

// ── Checkbox / Radio ───────────────────────────────────────────────────────────────────────────────────
async function controlCompare(kind: 'checkbox' | 'radio', locale: 'EN' | 'FA', props: Record<string, string>, browser: Browser, testInfo: TestInfo) {
  const v = variant(kind, { Locale: locale, ...props });
  const root = v.node;
  const glyph = kind === 'checkbox' ? layer(root, 'Control', 'Box') : layer(root, 'Control', 'Circle');
  const label = layer(root, 'Label').text?.characters ?? '';
  const state = pick(v).State;
  const checked = pick(v).Checked;
  const { page, close } = await newPage(browser, SCALE);
  const stage = await open(page, {
    c: kind,
    dir: locale === 'FA' ? 'rtl' : 'ltr',
    checked: checked === 'True' ? '1' : checked === 'Indeterminate' ? 'indeterminate' : '0',
    state: state === 'Disabled' ? 'disabled' : 'default',
    label,
  });
  await still(page);
  const control: Locator = stage.getByRole(kind);
  if (state === 'Hover') await control.hover();

  // The 16px control itself (EN and FA alike, wherever the inline start edge puts it): text-free, so it must match tightly.
  const b = await box(control);
  const s = await box(stage);
  await comparePixels({
    page,
    testInfo,
    reference: pngPath(kind, v),
    scale: SCALE,
    stage,
    referenceRegion: rect(glyph, root),
    actualRegion: { x: b.x - s.x, y: b.y - s.y, width: glyph.width, height: glyph.height },
    maxDiffRatio: 0.02,
  });

  if (locale === 'EN') {
    // EN is Geist in Figma and in code: the whole component too (label text differs by anti-aliasing / ≤1px width).
    const size = pngSize(readFileSync(pngPath(kind, v)));
    await comparePixels({
      page,
      testInfo,
      reference: pngPath(kind, v),
      scale: SCALE,
      stage,
      referenceRegion: { x: 0, y: 0, width: size.width / SCALE, height: size.height / SCALE },
      maxDiffRatio: 0.08,
    });
  }
  await close();
}

for (const locale of ['EN', 'FA'] as const) {
  // Figma's Focus variants are identical to Default (no indicator; decision O5 adds one in code), so Default covers them.
  for (const state of ['Default', 'Hover', 'Disabled']) {
    for (const checked of ['False', 'True', 'Indeterminate']) {
      test(`Checkbox ${locale} · ${checked} · ${state}`, async ({ browser }, testInfo) => controlCompare('checkbox', locale, { Checked: checked, State: state }, browser, testInfo));
    }
    for (const checked of ['False', 'True']) {
      test(`Radio ${locale} · ${checked} · ${state}`, async ({ browser }, testInfo) => controlCompare('radio', locale, { Checked: checked, State: state }, browser, testInfo));
    }
  }
}

// ── Groups: the two EN option cards of "Checkbox & Radio · Usage" (a 1x export, so this runs at deviceScaleFactor 1) ──
// The groups have no component set of their own in the pack, so the usage frame is the reference: its text and the
// regions below (title line box → last option) are what Figma drew. The 16px gap between a group's description and its
// first option is NOT in any component JSON: it was measured here (12px, the Setting Row gap, fits clearly worse). Compared at 1x against the frame's crop.
const usagePath = `${new URL('../../design/figma/png/usage/checkbox-and-radio-usage.png', import.meta.url).pathname}`;

const GROUPS: Array<{ name: string; params: Record<string, string>; region: Rect }> = [
  {
    name: 'Checkbox group',
    params: {
      c: 'checkbox-group',
      title: 'Show on',
      description: 'Post types where this block is displayed.',
      parent: 'All post types',
      options: 'post:Posts|page:Pages|product:Products',
      value: 'post,page',
    },
    region: { x: 90, y: 298, width: 354, height: 174 },
  },
  {
    name: 'Radio group',
    params: {
      c: 'radio-group',
      title: 'Layout',
      description: 'How content is laid out on the page.',
      options: 'full:Full width:Content spans the entire screen.|boxed:Boxed:Content sits in a centered 1200px column.|sidebar:With sidebar:Available in the Pro version.:disabled',
      value: 'full',
    },
    region: { x: 90, y: 648, width: 354, height: 203 },
  },
];

for (const g of GROUPS) {
  test(`${g.name} (EN) matches the usage frame`, async ({ browser }, testInfo) => {
    const { page, close } = await newPage(browser, 1);
    const stage = await open(page, g.params);
    await still(page);
    const result = await comparePixels({
      page,
      testInfo,
      reference: usagePath,
      scale: 1,
      stage,
      referenceRegion: g.region,
      actualRegion: { x: 0, y: 0, width: g.region.width, height: g.region.height },
      maxDiffRatio: 0.05, // measured 1.3 % / 2.8 % with the 16px header→options gap (12px: 3.1 % / 4.4 %)
    });
    console.log(`${g.name}: ${(result.ratio * 100).toFixed(2)}% differ`);
    await close();
  });
}

// ── Notice (the static part: tone icon, title, message) ──────────────────────────────────────────────────
// One test per locale for the default variant (Tone=Gray). EN compares the whole component; FA compares the icon box
// (its text is set in a different font than Figma's, its layout is the same mirrored one).
for (const locale of ['EN', 'FA'] as const) {
  test(`Notice ${locale} · default`, async ({ browser }, testInfo) => {
    const v = variant('notice', { Locale: locale, Tone: 'Gray' });
    const root = v.node;
    const icon = layer(root, 'Icon');
    const { page, close } = await newPage(browser, SCALE);
    const stage = await open(page, {
      c: 'notice',
      dir: locale === 'FA' ? 'rtl' : 'ltr',
      tone: 'gray',
      title: layer(root, 'Content', 'Title').text?.characters ?? '',
      message: layer(root, 'Content', 'Message').text?.characters ?? '',
    });
    await still(page);
    const size = pngSize(readFileSync(pngPath('notice', v)));
    if (locale === 'EN') {
      await comparePixels({ page, testInfo, reference: pngPath('notice', v), scale: SCALE, stage, maxDiffRatio: 0.08 });
    } else {
      const pad = 4;
      const ours = await box(stage.locator('[data-slot=fy-notice] svg'));
      const s = await box(stage);
      const region: Rect = { x: icon.x - pad, y: icon.y - pad, width: icon.width + pad * 2, height: icon.height + pad * 2 };
      await comparePixels({
        page,
        testInfo,
        reference: pngPath('notice', v),
        scale: SCALE,
        stage,
        referenceRegion: region,
        // our 16px glyph centred in the same 16×24 box, measured from the stage's top-left
        actualRegion: { x: ours.x - s.x - pad, y: ours.y - s.y - (icon.height - 16) / 2 - pad, width: region.width, height: region.height },
        maxDiffRatio: 0.03,
      });
      // the box must be exactly as tall as Figma draws it when the text fits on one line each (74 in FA)
      const boxHeight = (await box(stage.locator('[data-slot=fy-notice]'))).height;
      if (Math.abs(boxHeight - size.height / SCALE) > 26) throw new Error(`Notice height ${boxHeight} is far from the pack's ${size.height / SCALE}`);
    }
    await close();
  });
}
