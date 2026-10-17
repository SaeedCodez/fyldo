/**
 * Custom pages — one pixel test per new component, default variant, EN + FA, against the pack PNGs (design/figma/png, 2x):
 * Item Card (Type=Default, State=Default), Pagination and Stat Card (Trend=Up). Texts, icons, tones and positions come
 * from design/figma/components/*.json; the Item Card's media area holds the pack's placeholder icon box.
 *
 * EN compares the whole component (Geist in both). FA is IRANYekanX in Figma and Vazirmatn in code (docs/design-spec.md
 * D11): it compares the text-free parts and asserts the mirrored geometry. Failures attach actual / expected / diff.
 */
import { test } from '@playwright/test';
import { open } from './support/figma';
import { digits, layer, variant, type Node } from './support/pack';
import { instances, label } from './support/shell';
import { at, compare, dirOf, expect, newPage, relative, size, wholePng, type Compare } from './support/visual';

const LOCALES = ['EN', 'FA'] as const;
const text = (n: Node): string => n.text?.characters ?? '';

/** A nested instance's variant property ("Tone=Green" → "green"). */
const axis = (n: Node, name: string): string => (new RegExp(`${name}=(\\w+)`).exec(n.instance?.variant ?? '')?.[1] ?? '').toLowerCase();

/** The library icon behind an instance swap ("edit-2 / Property 1=linear" → "edit-2"). */
const swap = (n: Node, prop = 'Icon'): string => {
  const props = n.instance?.componentProperties ?? {};
  const key = Object.keys(props).find((k) => k === prop || k.startsWith(`${prop}#`));
  return (key ? (props[key]?.valueName ?? '') : '').split(' / ')[0] ?? '';
};

/** Children in reading order: left to right in EN, right to left in FA. */
const reading = (nodes: Node[], locale: 'EN' | 'FA'): Node[] => [...nodes].sort((a, b) => (locale === 'EN' ? a.x - b.x : b.x - a.x));

/**
 * The code's name for a pack icon, where the Iconsax library and the code's icon set differ (found by geometry matching,
 * as for support/shell.ts `ICON_BY_SWAP`): the library's "chart" (bars in a rounded square) is the code's `chart-21`, and
 * its "arrow-up" / "arrow-down" (chevrons) are `arrow-up-2` / `arrow-down-2`.
 */
const CODE_ICON: Record<string, string> = { chart: 'chart-21', 'arrow-up': 'arrow-up-2', 'arrow-down': 'arrow-down-2' };
const codeIcon = (name: string): string => CODE_ICON[name] ?? name;

const iconOf = (n: Node): string => codeIcon((n.children ?? []).find((c) => c.icon)?.icon?.name ?? '');

/** Our element's box, grown by the same 4px as `at()`, sized like the pack node (text-free glyph regions). */
const around = (ours: { x: number; y: number }, n: Node, pad = 4) => ({ x: ours.x - pad, y: ours.y - pad, width: n.width + pad * 2, height: n.height + pad * 2 });

// ── Item Card (Type=Default, State=Default) ───────────────────────────────────────────────────────────────────
for (const locale of LOCALES) {
  test(`Item Card ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Locale: locale, Type: 'Default', State: 'Default' };
    const root = variant('item-card', props).node;
    const ref = wholePng('item-card', props);
    expect(size(ref)).toEqual([root.width, root.height]);
    const footer = layer(root, 'Footer');
    const actions = reading(instances(layer(footer, 'Actions'), 'Icon Button'), locale);
    const badge = (name: string) => {
      const n = layer(root, 'Badges', name);
      return { label: label(n, locale), tone: axis(n, 'Tone') };
    };
    const spec = {
      title: text(layer(root, 'Heading', 'Title')),
      meta: text(layer(root, 'Heading', 'Meta')),
      media: true,
      status: badge('Status'),
      flag: badge('Extra'),
      tags: reading(instances(layer(root, 'Tags'), 'Tag'), locale).map((n) => label(n, locale)),
      details: ['Meta 1', 'Meta 2'].map((name) => {
        const item = layer(footer, 'Meta', name);
        return { icon: iconOf(item), label: text(layer(item, 'Label')) };
      }),
      actions: actions.map((n) => ({ icon: swap(n), label: n.name })),
    };
    const placeholder = layer(root, 'Media', 'Media content');

    const { page, close } = await newPage(browser);
    const stage = await open(page, { c: 'item-card', dir: dirOf(locale), spec: JSON.stringify(spec), names: 'gallery' });
    await page.mouse.move(0, 0);
    const card = page.locator('[data-slot=fy-item-card]');
    const ours = await relative(stage, card);
    expect(ours.width).toBe(root.width);
    if (locale === 'EN') expect(size(ours)).toEqual([root.width, root.height]);

    if (locale === 'EN') {
      await compare({ page, testInfo, stage, set: 'item-card', props, region: ref, actual: ours });
    } else {
      // text-free: the media placeholder, centred in the media area, and each action button at the inline end (left)
      const c = (region: Compare['region'], actual: Compare['actual']) => compare({ page, testInfo, stage, set: 'item-card', props, region, actual, max: 0.05 });
      await c(at(ref, placeholder), at(ours, placeholder));
      for (const n of actions) {
        const button = await relative(stage, card.getByRole('button', { name: n.name }));
        await c(at(ref, n), around(button, n));
      }
      // the footer meta icons, at the start (right) of each item
      for (const [index, name] of ['Meta 1', 'Meta 2'].entries()) {
        const icon = (layer(footer, 'Meta', name).children ?? []).find((n) => n.icon) as Node;
        const glyph = await relative(stage, card.locator('[data-slot=fy-item-card-footer] [data-fyldo-icon]').nth(index));
        await c(at(ref, icon, 2), around(glyph, icon, 2));
      }
      // mirrored: the status badge at the top right, the flag at the top left; the actions left of the footer meta
      const status = await relative(stage, card.getByText(spec.status.label));
      const flag = await relative(stage, card.getByText(spec.flag.label));
      expect(status.x, 'RTL: the status badge sits right of the flag').toBeGreaterThan(flag.x);
      const firstDetail = await relative(stage, card.getByText(spec.details[0]?.label ?? ''));
      const lastAction = await relative(stage, card.getByRole('button', { name: actions.at(-1)?.name ?? '' }));
      expect(firstDetail.x, 'RTL: the footer meta sits right of the actions').toBeGreaterThan(lastAction.x);
    }
    await close();
  });
}

// ── Pagination ────────────────────────────────────────────────────────────────────────────────────────────────
for (const locale of LOCALES) {
  test(`Pagination ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Locale: locale };
    const root = variant('pagination', props).node;
    const ref = wholePng('pagination', props);
    expect(size(ref)).toEqual([root.width, root.height]);
    const pageText = text(layer(root, 'Page'));
    const [current = 1, count = 1] = digits(pageText);
    const { page, close } = await newPage(browser);
    const stage = await open(page, {
      c: 'pagination',
      dir: dirOf(locale),
      page: String(current),
      count: String(count),
      summary: text(layer(root, 'Summary')),
      names: 'arrow-left,arrow-right',
    });
    await page.mouse.move(0, 0);
    const nav = page.getByRole('navigation');
    const ours = await relative(stage, nav);
    expect(size(ours)).toEqual([root.width, root.height]);

    // Previous is disabled on the first page (Secondary Small Disabled in the pack), Next is not
    // The gallery loads the Persian translations for FA: the buttons are named in the page's language.
    const previous = nav.getByRole('button', { name: locale === 'EN' ? 'Previous page' : 'صفحه‌ی قبل' });
    const next = nav.getByRole('button', { name: locale === 'EN' ? 'Next page' : 'صفحه‌ی بعد' });
    await expect(previous).toHaveAttribute('aria-disabled', 'true');
    await expect(next).not.toHaveAttribute('aria-disabled', 'true');
    const shown = (await nav.locator('[data-slot=fy-pagination-page]').textContent()) ?? '';
    expect(digits(shown), 'page numbers').toEqual(digits(pageText));

    if (locale === 'EN') {
      expect(shown).toBe(pageText);
      await compare({ page, testInfo, stage, set: 'pagination', props, region: ref, actual: ours });
    } else {
      expect(shown, 'translated, with Persian numerals').toBe(pageText);
      // text-free: both arrow buttons (Previous points right in RTL), each where the row puts it; no margin, as Next
      // touches the PNG's left edge
      for (const [name, locator] of [['Previous', previous], ['Next', next]] as const) {
        const n = layer(root, 'Controls', name);
        const button = await relative(stage, locator);
        await compare({ page, testInfo, stage, set: 'pagination', props, region: at(ref, n, 0), actual: around(button, n, 0), max: 0.05 });
      }
      const p = await relative(stage, previous);
      const nx = await relative(stage, next);
      expect(p.x, 'RTL: Previous sits right of Next').toBeGreaterThan(nx.x);
      expect(nx.x, 'RTL: the controls sit at the left edge').toBe(layer(root, 'Controls', 'Next').x);
      const summary = await relative(stage, nav.getByText(text(layer(root, 'Summary'))));
      expect(summary.x + summary.width, 'RTL: the summary ends at the right edge').toBeCloseTo(root.width, 0);
    }
    await close();
  });
}

// ── Stat Card (Trend=Up) ──────────────────────────────────────────────────────────────────────────────────────
for (const locale of LOCALES) {
  test(`Stat Card ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Locale: locale, Trend: 'Up' };
    const root = variant('stat-card', props).node;
    const ref = wholePng('stat-card', props);
    expect(size(ref)).toEqual([root.width, root.height]);
    const iconBox = layer(root, 'Header', 'Icon box');
    const delta = layer(root, 'Footer', 'Delta');
    expect(axis(delta, 'Tone')).toBe('green');
    const { page, close } = await newPage(browser);
    const stage = await open(page, {
      c: 'stat-card',
      dir: dirOf(locale),
      label: text(layer(root, 'Header', 'Label')),
      value: text(layer(root, 'Value')),
      icon: iconOf(iconBox),
      trend: 'up',
      delta: label(delta, locale),
      comparison: text(layer(root, 'Footer', 'Comparison')),
      names: codeIcon(swap(delta, 'Icon swap')),
    });
    await page.mouse.move(0, 0);
    const card = page.locator('[data-slot=fy-stat-card]');
    const ours = await relative(stage, card);
    expect(ours.width).toBe(root.width);
    await expect(card.locator('[data-slot=fy-badge]')).toHaveAttribute('data-tone', 'green');
    // the delta's arrow is the pack's swap
    await expect(card.locator('[data-slot=fy-badge] svg')).toHaveAttribute('data-fyldo-icon', codeIcon(swap(delta, 'Icon swap')).replace(/-/g, ''));

    if (locale === 'EN') {
      expect(size(ours)).toEqual([root.width, root.height]);
      await compare({ page, testInfo, stage, set: 'stat-card', props, region: ref, actual: ours });
    } else {
      // text-free: the icon box, at the inline end of the header (left)
      await compare({ page, testInfo, stage, set: 'stat-card', props, region: at(ref, iconBox), actual: at(ours, iconBox), max: 0.05 });
      const badge = await relative(stage, card.locator('[data-slot=fy-badge]'));
      expect(badge.x + badge.width, 'RTL: the delta starts the footer at the right').toBeCloseTo(delta.x + delta.width, -1);
    }
    await close();
  });
}
