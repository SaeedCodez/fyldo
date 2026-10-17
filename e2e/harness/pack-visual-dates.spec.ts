/**
 * Pixel comparison of the date and time picker sets (Date Field, Calendar Cell, Calendar Panel, Time Panel) against the
 * Figma pack, default variant, EN + FA, at deviceScaleFactor 2 — the scale the component PNGs were exported at.
 *
 * The pack draws 17 October 2026 as today and the 20th as the chosen day, so the gallery pins the clock (`today=`). EN is
 * Geist in Figma and in code; FA is IRANYekanX in Figma and Vazirmatn in code (docs/design-spec.md D11), so FA allows more
 * difference, or compares the text-free glyphs only. Failures attach actual / expected / diff.
 */
import { test, type Browser, type Locator, type Page } from '@playwright/test';
import { box, open } from './support/figma';
import { layer, pngPath, variant, type Node } from './support/pack';
import { comparePixels, type Rect } from './support/pixels';

const SCALE = 2;
const TODAY = '2026-10-17';

async function newPage(browser: Browser) {
  const context = await browser.newContext({ deviceScaleFactor: SCALE, reducedMotion: 'reduce' });
  return { page: await context.newPage(), close: () => context.close() };
}

/** Freeze what moves (caret, spinner) so a screenshot is stable. */
const still = (page: Page) => page.addStyleTag({ content: '*{caret-color:transparent !important}[data-fyldo-spinner]{animation:none !important}' });

const rect = (n: Node, parent: Node): Rect => ({ x: n.x - parent.x, y: n.y - parent.y, width: n.width, height: n.height });

const dir = (locale: 'EN' | 'FA') => (locale === 'FA' ? 'rtl' : 'ltr');

// ── Date Field ──────────────────────────────────────────────────────────────────────────────────────────────────────
// Default variant: Small, Default (nothing chosen: the placeholder). EN compares the whole field; FA compares the two glyphs
// of the control (the calendar icon at the start, the chevron at the end).
for (const locale of ['EN', 'FA'] as const) {
  test(`Date Field ${locale} · default`, async ({ browser }) => {
    const v = variant('date-field', { Locale: locale, Size: 'Small', State: 'Default' });
    const root = v.node;
    const control = layer(root, 'Control');
    const { page, close } = await newPage(browser);
    const stage = await open(page, {
      c: 'date-field',
      dir: dir(locale),
      size: 'sm',
      today: TODAY,
      label: layer(root, 'Label').text?.characters ?? '',
      placeholder: layer(control, 'Placeholder').text?.characters ?? '',
      helper: layer(root, 'Helper text').text?.characters ?? '',
      names: 'calendar,arrow-down-2',
    });
    await still(page);
    const testInfo = test.info();
    if (locale === 'EN') {
      await comparePixels({ page, testInfo, reference: pngPath('date-field', v), scale: SCALE, stage, maxDiffRatio: 0.08 });
    } else {
      const s = await box(stage);
      const ours: Array<[string, Locator]> = [
        ['Icon', stage.locator('[data-slot=fy-date-field] > span:first-child')],
        ['Chevron', stage.locator('[data-slot=fy-date-field] > span:last-child')],
      ];
      for (const [name, locator] of ours) {
        const region = rect(layer(control, name), root);
        const b = await box(locator);
        await comparePixels({
          page,
          testInfo,
          reference: pngPath('date-field', v),
          scale: SCALE,
          stage,
          referenceRegion: region,
          actualRegion: { x: b.x - s.x, y: b.y - s.y, width: region.width, height: region.height },
          maxDiffRatio: 0.1,
        });
      }
    }
    await close();
  });
}

// ── Calendar Cell ───────────────────────────────────────────────────────────────────────────────────────────────────
// Default variant: a Day with its numeral and nothing else. In FA the numeral is the whole cell and is set in another font,
// hence the wider allowance; a misplaced or mis-sized numeral still fails.
for (const locale of ['EN', 'FA'] as const) {
  test(`Calendar Cell ${locale} · default`, async ({ browser }) => {
    const v = variant('calendar-cell', { Locale: locale, Kind: 'Day', State: 'Default' });
    const { page, close } = await newPage(browser);
    const stage = await open(page, { c: 'calendar-cell', dir: dir(locale), kind: 'day', state: 'default', label: layer(v.node, 'Label').text?.characters ?? '' });
    await still(page);
    await comparePixels({ page, testInfo: test.info(), reference: pngPath('calendar-cell', v), scale: SCALE, stage, maxDiffRatio: locale === 'EN' ? 0.08 : 0.2 });
    await close();
  });
}

// ── Calendar Panel ──────────────────────────────────────────────────────────────────────────────────────────────────
// Default variant: Gregorian, Days, with the calendar switch and the footer: October 2026, the 20th chosen, the 17th today.
// The pack's FA Gregorian panel starts its weeks on Saturday (that site's "Week starts on"), so FA passes start=6. The PNG
// includes the Shadow/Medium margin (16px each side, none above), so the card is cropped out of it.
for (const locale of ['EN', 'FA'] as const) {
  test(`Calendar Panel ${locale} · default`, async ({ browser }) => {
    const v = variant('calendar-panel', { Locale: locale, Calendar: 'Gregorian', View: 'Days' });
    const root = v.node;
    const { page, close } = await newPage(browser);
    const stage = await open(page, {
      c: 'calendar-panel',
      dir: dir(locale),
      calendar: 'gregorian',
      value: '2026-10-20',
      today: TODAY,
      start: locale === 'FA' ? '6' : '1',
      names: 'arrow-down-2,arrow-left-2,arrow-right-2',
    });
    await still(page);
    const card = { x: 16, y: 0, width: root.width, height: root.height };
    await comparePixels({
      page,
      testInfo: test.info(),
      reference: pngPath('calendar-panel', v),
      scale: SCALE,
      stage,
      referenceRegion: card,
      actualRegion: { x: 0, y: 0, width: card.width, height: card.height },
      maxDiffRatio: locale === 'EN' ? 0.08 : 0.12,
    });
    await close();
  });
}

// ── Time Panel ──────────────────────────────────────────────────────────────────────────────────────────────────────
// Default variant: Popup, 14:30 on a 5-minute step (the columns scroll so the choice is the fourth row), with "Now".
for (const locale of ['EN', 'FA'] as const) {
  test(`Time Panel ${locale} · default`, async ({ browser }) => {
    const v = variant('time-panel', { Locale: locale, Type: 'Popup' });
    const root = v.node;
    const { page, close } = await newPage(browser);
    const stage = await open(page, { c: 'time-panel', dir: dir(locale), type: 'popup', value: '14:30', step: '5' });
    await still(page);
    const card = { x: 16, y: 0, width: root.width, height: root.height };
    await comparePixels({
      page,
      testInfo: test.info(),
      reference: pngPath('time-panel', v),
      scale: SCALE,
      stage,
      referenceRegion: card,
      actualRegion: { x: 0, y: 0, width: card.width, height: card.height },
      maxDiffRatio: locale === 'EN' ? 0.08 : 0.12,
    });
    await close();
  });
}
