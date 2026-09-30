/**
 * M4 — one pixel test per new component, default variant, EN + FA, against the pack PNGs (design/figma/png, 2x):
 * Toast (Neutral), Tooltip (Top), Empty State (Large), Icon Button (Tertiary Small… the pack's Type=Primary Small default),
 * and the Modal's new Type=Danger. Texts, icons and positions come from design/figma/components/*.json.
 *
 * EN compares the whole component (Geist in both). FA is IRANYekanX in Figma and Vazirmatn in code (docs/design-spec.md
 * D11): it compares the text-free parts and asserts the mirrored geometry. Coarse guard by nature (anti-aliasing and
 * hinting differ between Figma and Chrome); failures attach actual / expected / diff.
 */
import { test } from '@playwright/test';
import { open } from './support/figma';
import { layer, variant, type Node } from './support/pack';
import { instances, label } from './support/shell';
import { at, compare, componentIn, dirOf, expect, newPage, relative, size, wholePng } from './support/visual';

const LOCALES = ['EN', 'FA'] as const;
const text = (n: Node): string => n.text?.characters ?? '';

// ── Toast (Tone=Neutral) ──────────────────────────────────────────────────────────────────────────────────────
for (const locale of LOCALES) {
  test(`Toast ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Locale: locale, Tone: 'Neutral' };
    const root = variant('toast', props).node;
    const ref = componentIn('toast', props);
    expect(size(ref)).toEqual([root.width, root.height]);
    const { page, close } = await newPage(browser);
    const stage = await open(page, { c: 'toast', dir: dirOf(locale), tone: 'neutral', title: text(layer(root, 'Message')) });
    const toast = page.locator('[data-slot=fy-toast]');
    await expect(toast).toBeVisible();
    await page.mouse.move(0, 0);
    const ours = await relative(stage, toast);
    expect(size(ours)).toEqual([root.width, root.height]);

    // 24px from the bottom-end corner: bottom-right in LTR, bottom-left in RTL
    const viewport = page.viewportSize() as { width: number; height: number };
    const [left, top] = [ours.x + (await stage.evaluate((el) => el.getBoundingClientRect().x)), ours.y + (await stage.evaluate((el) => el.getBoundingClientRect().y))];
    expect(viewport.height - (top + ours.height), 'bottom edge 24px from the viewport').toBe(24);
    expect(locale === 'EN' ? viewport.width - (left + ours.width) : left, 'end edge 24px from the viewport').toBe(24);

    if (locale === 'EN') {
      await compare({ page, testInfo, stage, set: 'toast', props, region: ref, actual: ours });
    } else {
      // the tone icon at the inline start (right) and the close button at the inline end (left): text-free parts
      for (const name of ['Icon', 'Close']) {
        const node = layer(root, name);
        await compare({ page, testInfo, stage, set: 'toast', props, region: at(ref, node), actual: at(ours, node), max: 0.05 });
      }
    }
    await close();
  });
}

// ── Tooltip (Placement=Top) ───────────────────────────────────────────────────────────────────────────────────
for (const locale of LOCALES) {
  test(`Tooltip ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Locale: locale, Placement: 'Top' };
    const root = variant('tooltip', props).node;
    const ref = wholePng('tooltip', props);
    const bubbleNode = layer(root, 'Bubble');
    const { page, close } = await newPage(browser);
    const stage = await open(page, { c: 'tooltip', dir: dirOf(locale), placement: 'top', label: text(layer(root, 'Label')) });
    await page.keyboard.press('Tab'); // keyboard focus opens it at once
    const bubble = page.locator('[data-slot=fy-tooltip]');
    await expect(bubble).toBeVisible();
    await page.mouse.move(0, 0);
    const b = await relative(stage, bubble);
    expect(b.height, 'bubble height').toBe(bubbleNode.height);
    if (locale === 'EN') expect(b.width, 'bubble width').toBe(bubbleNode.width);

    // the arrow tip sits 6px from the button (measured on the Tooltip usage frame)
    const button = await relative(stage, page.getByRole('button', { name: text(layer(root, 'Label')) }));
    expect(button.y - (b.y + b.height + 5), 'arrow tip to trigger').toBe(6);

    if (locale === 'EN') {
      // bubble + the 10×5 arrow drawn below it
      await compare({ page, testInfo, stage, set: 'tooltip', props, region: ref, actual: { x: b.x, y: b.y, width: ref.width, height: ref.height } });
    } else {
      // text-free: the arrow, centred under the bubble
      const arrow = layer(root, 'Arrow');
      const height = ref.height - (arrow.y - 2); // down to the PNG's bottom edge
      await compare({
        page,
        testInfo,
        stage,
        set: 'tooltip',
        props,
        region: { x: arrow.x - 2, y: arrow.y - 2, width: arrow.width + 4, height },
        actual: { x: b.x + b.width / 2 - arrow.width / 2 - 2, y: b.y + arrow.y - 2, width: arrow.width + 4, height },
        max: 0.05,
      });
    }

    // Start and End follow the reading direction: in RTL, Start is on the right of the trigger
    for (const [side, physical] of [['start', locale === 'EN' ? 'left' : 'right'], ['end', locale === 'EN' ? 'right' : 'left']] as const) {
      await page.goto(page.url().replace(/placement=\w+/, `placement=${side}`));
      await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
      await page.evaluate(() => document.fonts.ready);
      await page.keyboard.press('Tab');
      const sided = page.locator('[data-slot=fy-tooltip]');
      await expect(sided).toBeVisible();
      const sb = await sided.boundingBox();
      const trigger = await page.getByRole('button', { name: text(layer(root, 'Label')) }).boundingBox();
      if (!sb || !trigger) throw new Error('no box');
      if (physical === 'left') expect(sb.x + sb.width, `${side}: left of the trigger`).toBeLessThan(trigger.x);
      else expect(sb.x, `${side}: right of the trigger`).toBeGreaterThan(trigger.x + trigger.width);
    }
    await close();
  });
}

// ── Empty State (Size=Large) ──────────────────────────────────────────────────────────────────────────────────
for (const locale of LOCALES) {
  test(`Empty State ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Locale: locale, Size: 'Large' };
    const root = variant('empty-state', props).node;
    const ref = wholePng('empty-state', props);
    const buttons = instances(layer(root, 'Actions'), 'Button');
    const named = (name: string) => label(buttons.find((n) => n.name === name) as Node, locale);
    const { page, close } = await newPage(browser);
    const stage = await open(page, {
      c: 'empty-state',
      dir: dirOf(locale),
      size: 'lg',
      icon: layer(root, 'Icon box', 'Icon').icon?.name ?? 'element-plus',
      title: text(layer(root, 'Title')),
      description: text(layer(root, 'Description')),
      primary: named('Primary action'),
      secondary: named('Secondary action'),
    });
    await page.mouse.move(0, 0);
    const ours = await relative(stage, page.locator('[data-slot=fy-empty-state]'));
    expect(size(ours)[0]).toBe(root.width);
    if (locale === 'EN') expect(size(ours)).toEqual([root.width, root.height]);

    if (locale === 'EN') {
      await compare({ page, testInfo, stage, set: 'empty-state', props, region: ref, actual: { x: ours.x, y: ours.y, width: ref.width, height: ref.height } });
    } else {
      // the icon box, centred at the top (text-free); the actions row order is mirrored (Secondary before Primary, left to right)
      const box = layer(root, 'Icon box');
      await compare({ page, testInfo, stage, set: 'empty-state', props, region: at(ref, box), actual: at(ours, box), max: 0.05 });
      const primary = await relative(stage, page.getByRole('button', { name: named('Primary action') }));
      const secondary = await relative(stage, page.getByRole('button', { name: named('Secondary action') }));
      expect(primary.x, 'RTL: Primary sits right of Secondary').toBeGreaterThan(secondary.x);
    }
    await close();
  });
}

// ── Icon Button (Type=Primary, Size=Small, State=Default: the set's default) ──────────────────────────────────
for (const locale of LOCALES) {
  test(`Icon Button ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Type: 'Primary', Size: 'Small', State: 'Default' };
    const root = variant('icon-button', props).node;
    const ref = wholePng('icon-button', props);
    expect(size(ref)).toEqual([root.width, root.height]);
    const { page, close } = await newPage(browser);
    const stage = await open(page, { c: 'icon-button', dir: dirOf(locale), variant: 'primary', size: 'sm', icon: layer(root, 'Icon').icon?.name ?? 'more', label: 'More' });
    await page.mouse.move(0, 0);
    const ours = await relative(stage, page.getByRole('button', { name: 'More' }));
    expect(size(ours)).toEqual([root.width, root.height]);
    // no Locale axis in the pack: the same picture in both directions (the icon does not mirror)
    await compare({ page, testInfo, stage, set: 'icon-button', props, region: ref, actual: ours, max: 0.05 });
    await close();
  });
}

// ── Modal (Type=Danger: "Reset all settings?" with the typed confirmation) ───────────────────────────────────
for (const locale of LOCALES) {
  test(`Modal Danger ${locale} · default`, async ({ browser }, testInfo) => {
    const props = { Locale: locale, Type: 'Danger' };
    const root = variant('modal', props).node;
    const ref = componentIn('modal', props);
    expect(size(ref)).toEqual([root.width, root.height]);
    const footer = layer(root, 'Footer');
    const button = (name: string) => instances(footer, 'Button').find((n) => n.name === name) as Node;
    const input = layer(root, 'Body', 'Confirmation');
    const { page, close } = await newPage(browser);
    const stage = await open(page, {
      c: 'modal',
      type: 'danger',
      dir: dirOf(locale),
      title: text(layer(root, 'Title')),
      description: text(layer(root, 'Description')),
      cancel: label(button('Cancel'), locale),
      confirm: label(button('Confirm'), locale),
      keyword: input.instance?.texts?.Placeholder ?? 'RESET',
    });
    const modal = page.locator('[data-slot=fy-modal]');
    await expect(modal).toBeVisible();
    await page.mouse.move(0, 0);
    // the focus ring on the keyword field (initial focus) is not in the pack: take it off for the picture
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const ours = await relative(stage, modal);
    expect([ours.width, Math.round(ours.height)]).toEqual([root.width, root.height]);

    // the confirmation Input (label above, 40px control) and the disabled Error confirm button are where the pack puts them
    const field = await relative(stage, modal.locator('[data-slot=fy-input]'));
    expect(Math.round(field.height)).toBe(40);
    expect(Math.round(field.width)).toBe(430); // 478 − 24 − 24
    await expect(modal.getByRole('button', { name: label(button('Confirm'), locale) })).toBeDisabled();

    if (locale === 'EN') {
      await compare({ page, testInfo, stage, set: 'modal', props, region: ref, actual: ours });
    } else {
      const closeButton = layer(root, 'Header', 'Close');
      await compare({ page, testInfo, stage, set: 'modal', props, region: at(ref, closeButton), actual: at(ours, closeButton), max: 0.03 });
    }
    await close();
  });
}
