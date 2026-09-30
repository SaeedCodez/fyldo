/**
 * M3 part 1 — one pixel test per new shell component (the default variant, EN + FA) against the pack PNGs
 * (design/figma/png, 2x): Badge, Nav Item, Tab, Tabs, Sidebar, Top Navigation, Page Header and Section Card.
 *
 * EN compares the component (Figma and code both use Geist). FA is IRANYekanX in Figma and Vazirmatn in code
 * (docs/design-spec.md D11), so FA compares text-free parts — icon boxes, the tab indicator, the toggle — and checks the
 * geometry that the FA line heights drive (a Nav Item is 34px tall in FA, a Tab 50).
 *
 * Every text, icon and position comes from design/figma/components/*.json (support/shell.ts). The brand (logo · name ·
 * version) has its own test below (M3 part 2: the default logo is the Fyldo mark, design/figma/brand).
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
import { box, open } from './support/figma';
import { layer, pngPath, pngSize, variant, type Node } from './support/pack';
import { comparePixels, type Rect } from './support/pixels';
import { ICON_BY_SWAP, instances, label, navSpec, type Locale } from './support/shell';

const SCALE = 2;
const PAD = 4;

async function newPage(browser: Browser) {
  const context = await browser.newContext({
    deviceScaleFactor: SCALE,
    reducedMotion: 'reduce',
    viewport: { width: 1400, height: 1000 },
  });
  return { page: await context.newPage(), close: () => context.close() };
}

const still = (page: Page) =>
  page.addStyleTag({ content: '*{caret-color:transparent !important}' });
const dir = (locale: Locale) => (locale === 'FA' ? 'rtl' : 'ltr');

/** The whole reference image, in CSS px. */
const whole = (set: string, props: Record<string, string>): Rect => {
  const size = pngSize(readFileSync(pngPath(set, variant(set, props))));
  return { x: 0, y: 0, width: size.width / SCALE, height: size.height / SCALE };
};

/** A pack node's box relative to the component root, grown by `pad`. */
const around = (n: Node, pad = PAD): Rect => ({
  x: n.x - pad,
  y: n.y - pad,
  width: n.width + pad * 2,
  height: n.height + pad * 2,
});

/** One of our elements' box relative to the stage, grown by `pad` (same size as `around` for a same-sized element). */
async function ours(
  stage: Locator,
  target: Locator,
  width: number,
  height: number,
  pad = PAD,
): Promise<Rect> {
  const s = await box(stage);
  const b = await box(target);
  return {
    x: b.x - s.x + (b.width - width) / 2 - pad,
    y: b.y - s.y + (b.height - height) / 2 - pad,
    width: width + pad * 2,
    height: height + pad * 2,
  };
}

interface Compare {
  page: Page;
  testInfo: TestInfo;
  stage: Locator;
  set: string;
  props: Record<string, string>;
  region?: Rect;
  actual?: Rect;
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
    `${c.set} ${JSON.stringify(c.props)}${c.region ? ` @${c.region.x},${c.region.y}` : ''}: ${(result.ratio * 100).toFixed(2)}% differ`,
  );
  return result;
};

// ── Badge (Gray · Subtle · Small) ─────────────────────────────────────────────────────────────────────────────
for (const locale of ['EN', 'FA'] as const) {
  test(`Badge ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Locale: locale, Tone: 'Gray', Style: 'Subtle', Size: 'Small' };
    const root = variant('badge', props).node;
    const { page, close } = await newPage(browser);
    const stage = await open(page, {
      c: 'badge',
      dir: dir(locale),
      label: layer(root, 'Label').text?.characters ?? '',
    });
    if (locale === 'EN') {
      // 10%: the text box is where Figma puts it (y 2, 16 high) but Chrome draws Geist Medium 12 one pixel lower than
      // Figma; shifted by that pixel only 3 of 3920 device pixels differ. The label is ~40% of this small component.
      await compare({ page, testInfo, stage, set: 'badge', props, max: 0.1 });
    } else {
      // the two pill caps (the label between them is set in another font)
      const ourBadge = await box(stage.locator('[data-slot=fy-badge]'));
      const s = await box(stage);
      expect(ourBadge.height).toBe(root.height);
      for (const atEnd of [false, true]) {
        const region: Rect = { x: atEnd ? root.width - 8 : 0, y: 0, width: 8, height: root.height };
        await compare({
          page,
          testInfo,
          stage,
          set: 'badge',
          props,
          region,
          actual: {
            ...region,
            x: ourBadge.x - s.x + (atEnd ? ourBadge.width - 8 : 0),
            y: ourBadge.y - s.y,
          },
          max: 0.05,
        });
      }
    }
    await close();
  });
}

// ── Nav Item (Default) ────────────────────────────────────────────────────────────────────────────────────────
for (const locale of ['EN', 'FA'] as const) {
  test(`Nav Item ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Locale: locale, State: 'Default' };
    const root = variant('nav-item', props).node;
    const icon = layer(root, 'Icon');
    const { page, close } = await newPage(browser);
    const stage = await open(page, {
      c: 'nav-item',
      dir: dir(locale),
      state: 'default',
      label: layer(root, 'Label').text?.characters ?? '',
      icon: icon.icon?.name ?? '',
    });
    await still(page);
    const item = stage.locator('[data-slot=fy-nav-item]');
    expect((await box(item)).height, 'height follows the locale line height').toBe(root.height);
    if (locale === 'EN') {
      await compare({ page, testInfo, stage, set: 'nav-item', props });
    } else {
      await compare({
        page,
        testInfo,
        stage,
        set: 'nav-item',
        props,
        region: around(icon),
        actual: await ours(stage, item.locator('svg'), 16, 16),
        max: 0.05,
      });
    }
    await close();
  });
}

// ── Tab (Default) ─────────────────────────────────────────────────────────────────────────────────────────────
for (const locale of ['EN', 'FA'] as const) {
  test(`Tab ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Locale: locale, State: 'Default' };
    const root = variant('tab', props).node;
    const content = layer(root, 'Content');
    const { page, close } = await newPage(browser);
    const stage = await open(page, {
      c: 'tab',
      dir: dir(locale),
      state: 'default',
      label: layer(root, 'Label').text?.characters ?? '',
    });
    await still(page);
    const tab = await box(stage.locator('button'));
    expect(tab.height, 'height follows the locale line height').toBe(root.height);
    if (locale === 'EN') {
      await compare({ page, testInfo, stage, set: 'tab', props });
    } else {
      // below the content box: the 6px gap and the (inactive, empty) 2px indicator
      const region: Rect = {
        x: 0,
        y: content.y + content.height,
        width: root.width,
        height: root.height - content.y - content.height,
      };
      await compare({
        page,
        testInfo,
        stage,
        set: 'tab',
        props,
        region,
        actual: { ...region, width: Math.min(region.width, tab.width) },
        max: 0.02,
      });
    }
    await close();
  });
}

// ── Tabs (the first tab active) ───────────────────────────────────────────────────────────────────────────────
for (const locale of ['EN', 'FA'] as const) {
  test(`Tabs ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Locale: locale };
    const root = variant('tabs', props).node;
    const tabs = instances(root, 'Tab');
    const inOrder = locale === 'FA' ? [...tabs].reverse() : tabs; // an RTL row lists its children from the end
    const { page, close } = await newPage(browser);
    const stage = await open(page, {
      c: 'tabs',
      dir: dir(locale),
      tabs: inOrder.map((t) => label(t, locale)).join('|'),
    });
    await still(page);
    if (locale === 'EN') {
      await compare({ page, testInfo, stage, set: 'tabs', props });
    } else {
      // the active tab's indicator over the divider, at the START (right) of the row
      const active = inOrder[0] as Node;
      const ourTab = await box(stage.locator('[role=tab][aria-selected=true]'));
      const s = await box(stage);
      expect(ourTab.height).toBe(root.height);
      expect(Math.round(ourTab.x + ourTab.width - s.x)).toBe(Math.round(active.x + active.width)); // flush with the end of the 800 row
      const region: Rect = {
        x: active.x + active.width - 40,
        y: root.height - 4,
        width: 40 + 8,
        height: 4,
      };
      await compare({
        page,
        testInfo,
        stage,
        set: 'tabs',
        props,
        region: { ...region, width: 40 },
        actual: { x: ourTab.x - s.x + ourTab.width - 40, y: root.height - 4, width: 40, height: 4 },
        max: 0.02,
      });
    }
    await close();
  });
}

// ── Sidebar ───────────────────────────────────────────────────────────────────────────────────────────────────
for (const locale of ['EN', 'FA'] as const) {
  test(`Sidebar ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Locale: locale };
    const root = variant('sidebar', props).node;
    const header = layer(root, 'Header');
    const spec = navSpec(root, locale, 'Nav Item');
    const { page, close } = await newPage(browser);
    const stage = await open(page, { c: 'sidebar', dir: dir(locale), spec: JSON.stringify(spec) });
    await still(page);
    const s = await box(stage);
    const packItems = instances(root, 'Nav Item');
    const ourItems = stage.locator('[data-slot=fy-nav-item]');
    await expect(ourItems).toHaveCount(packItems.length);
    // Every Nav Item where the pack puts it (groups, gaps, the footer pinned to the bottom of the 800px column).
    for (let i = 0; i < packItems.length; i++) {
      const b = await box(ourItems.nth(i));
      expect(Math.round(b.y - s.y), `item ${i} top`).toBe(Math.round((packItems[i] as Node).y));
    }

    if (locale === 'EN') {
      // navigation + footer: everything below the header
      const below: Rect = {
        x: 0,
        y: header.height,
        width: root.width,
        height: root.height - header.height,
      };
      await compare({ page, testInfo, stage, set: 'sidebar', props, region: below });
    } else {
      for (let i = 0; i < packItems.length; i++) {
        const n = packItems[i] as Node;
        const icon: Node = {
          ...n,
          x: n.x + n.width - 8 - 16,
          y: n.y + (n.height - 16) / 2,
          width: 16,
          height: 16,
        };
        await compare({
          page,
          testInfo,
          stage,
          set: 'sidebar',
          props,
          region: around(icon),
          actual: await ours(stage, ourItems.nth(i).locator('svg'), 16, 16),
          max: 0.05,
        });
      }
    }
    await close();
  });
}

// ── Brand (the default: the Fyldo mark · "Fyldo" · version badge), in the Sidebar header ─────────────────────
for (const locale of ['EN', 'FA'] as const) {
  test(`Brand ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Locale: locale };
    const root = variant('sidebar', props).node;
    const header = layer(root, 'Header');
    const logo = layer(header, 'Logo');
    const spec = navSpec(root, locale, 'Nav Item');
    const { page, close } = await newPage(browser);
    const stage = await open(page, { c: 'sidebar', dir: dir(locale), spec: JSON.stringify(spec) });
    await still(page);
    const s = await box(stage);
    const mark = stage.locator('[data-slot=fy-brand] [data-slot=fy-fyldo-mark]');
    const ourLogo = await box(mark);
    // the logo where the pack puts it: 20px in from the inline start of the header, 24×24
    expect([Math.round(ourLogo.x - s.x), Math.round(ourLogo.y - s.y), ourLogo.width, ourLogo.height]).toEqual([
      Math.round(logo.x),
      Math.round(logo.y),
      logo.width,
      logo.height,
    ]);
    const name = (await stage.locator('[data-slot=fy-brand-name]').boundingBox())!;
    const gapToName = locale === 'EN' ? name.x - (ourLogo.x + ourLogo.width) : ourLogo.x - (name.x + name.width);
    expect(Math.round(gapToName), 'gap 10 between the logo and the name').toBe(header.layout?.itemSpacing);

    if (locale === 'EN') {
      // the whole header: logo, name and badge (Geist in both)
      await compare({
        page,
        testInfo,
        stage,
        set: 'sidebar',
        props,
        region: { x: header.x, y: header.y, width: header.width, height: header.height },
      });
    } else {
      // the mark only: the name is IRANYekanX in Figma and Vazirmatn in code
      await compare({ page, testInfo, stage, set: 'sidebar', props, region: around(logo), max: 0.03 });
    }
    await close();
  });
}

// ── Top Navigation ────────────────────────────────────────────────────────────────────────────────────────────
for (const locale of ['EN', 'FA'] as const) {
  test(`Top Navigation ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Locale: locale };
    const root = variant('top-navigation', props).node;
    const header = layer(root, 'Header');
    const nav = layer(root, 'Navigation');
    const spec = navSpec(root, locale, 'Tab');
    const { page, close } = await newPage(browser);
    const stage = await open(page, {
      c: 'top-navigation',
      dir: dir(locale),
      width: String(root.width),
      spec: JSON.stringify(spec),
    });
    await still(page);
    const s = await box(stage);
    expect(Math.round((await box(stage.locator('[data-slot=fy-top-nav]'))).height)).toBe(
      root.height,
    );

    if (locale === 'EN') {
      // the navigation row, whole
      await compare({
        page,
        testInfo,
        stage,
        set: 'top-navigation',
        props,
        region: { x: 0, y: nav.y, width: root.width, height: root.height - nav.y },
      });
      // the utilities (flush with the end of the header row)
      const utilities = layer(header, 'Utilities');
      await compare({
        page,
        testInfo,
        stage,
        set: 'top-navigation',
        props,
        region: around(utilities),
        actual: await ours(
          stage,
          stage.locator('[data-slot=fy-top-nav-utilities]'),
          utilities.width,
          utilities.height,
        ),
      });
    } else {
      const tabs = instances(nav, 'Tab');
      const ourTabs = stage.locator('[data-slot=fy-top-nav-item]');
      await expect(ourTabs).toHaveCount(tabs.length);
      // icons in reading order: the pack lists the RTL row from its left end
      const inOrder = [...tabs].reverse();
      for (let i = 0; i < inOrder.length; i++) {
        const t = inOrder[i] as Node;
        const content = { x: t.x, y: t.y + 8, width: t.width, height: t.height - 16 };
        const icon: Node = {
          ...t,
          x: content.x + content.width - 12 - 16,
          y: content.y + (content.height - 16) / 2,
          width: 16,
          height: 16,
        };
        await compare({
          page,
          testInfo,
          stage,
          set: 'top-navigation',
          props,
          region: around(icon),
          actual: await ours(stage, ourTabs.nth(i).locator('svg'), 16, 16),
          max: 0.05,
        });
      }
    }
    void s;
    await close();
  });
}

// ── Page Header (with the Documentation action) ─────────────────────────────────────────────────────────────
for (const locale of ['EN', 'FA'] as const) {
  test(`Page Header ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Locale: locale };
    const root = variant('page-header', props).node;
    const action = instances(root, 'Button')[0] as Node;
    const { page, close } = await newPage(browser);
    const stage = await open(page, {
      c: 'page-header',
      dir: dir(locale),
      title: layer(root, 'Title').text?.characters ?? '',
      description: layer(root, 'Description').text?.characters ?? '',
      action: label(action, locale),
    });
    await still(page);
    const ourAction = stage.locator('[data-slot=fy-page-header-actions] a');
    await expect(ourAction.locator('svg')).toHaveAttribute(
      'data-fyldo-icon',
      ICON_BY_SWAP['8:12239']!.replace(/-/g, ''),
    );
    if (locale === 'EN') {
      await compare({ page, testInfo, stage, set: 'page-header', props });
    } else {
      // the trailing external-link icon (at the button's inline end = its left side in RTL)
      // 12px padding + the 1px stroke Figma counts in the layout (the EN icon matches at width − 12 − 1 − 16)
      const icon: Node = {
        ...action,
        x: action.x + 12 + 1,
        y: action.y + 8,
        width: 16,
        height: 16,
      };
      await compare({
        page,
        testInfo,
        stage,
        set: 'page-header',
        props,
        region: around(icon),
        actual: await ours(stage, ourAction.locator('svg'), 16, 16),
        max: 0.05,
      });
      expect(
        Math.round((await box(ourAction)).x - (await box(stage)).x),
        'the action sits at the inline end (left)',
      ).toBe(Math.round(action.x));
    }
    await close();
  });
}

// ── Section Card (Default: stacked, stacked, inline rows + footer) ─────────────────────────────────────────────
for (const locale of ['EN', 'FA'] as const) {
  test(`Section Card ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Locale: locale, Tone: 'Default' };
    const root = variant('section-card', props).node;
    const rows = instances(root, 'Setting Row');
    const footer = layer(root, 'Footer');
    const t = (n: Node) => n.instance?.texts ?? {};
    const spec = {
      title: layer(root, 'Header', 'Title').text?.characters ?? '',
      description: layer(root, 'Header', 'Description').text?.characters ?? '',
      rows: rows.map((r) => ({
        title: t(r).Title ?? '',
        description: t(r).Description ?? '',
        layout: r.instance?.variant.includes('Inline') ? 'inline' : 'stacked',
        value: t(r).Value ?? '',
      })),
      footerText: layer(footer, 'Footer text').text?.characters ?? '',
      action: instances(footer, 'Button')[0]?.instance?.texts?.Label ?? '',
    };
    const { page, close } = await newPage(browser);
    const stage = await open(page, {
      c: 'section-card',
      dir: dir(locale),
      spec: JSON.stringify(spec),
    });
    await still(page);
    if (locale === 'EN') {
      await compare({
        page,
        testInfo,
        stage,
        set: 'section-card',
        props,
        region: whole('section-card', props),
      });
    } else {
      // the inline row's toggle (text-free), at the row's END = left in RTL
      const inline = rows.find((r) => r.instance?.variant.includes('Inline')) as Node;
      const toggle: Node = {
        ...inline,
        x: inline.x,
        y: inline.y + (inline.height - 20) / 2,
        width: 36,
        height: 20,
      };
      await compare({
        page,
        testInfo,
        stage,
        set: 'section-card',
        props,
        region: around(toggle),
        actual: await ours(stage, stage.locator('[data-slot=fy-toggle]'), 36, 20),
        max: 0.05,
      });
      const card = await box(stage.locator('[data-slot=fy-section-card]'));
      expect(
        Math.abs(card.height - root.height),
        `card height ${card.height} vs ${root.height}`,
      ).toBeLessThanOrEqual(6);
    }
    await close();
  });
}
