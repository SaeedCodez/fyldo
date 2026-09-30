/**
 * Milestone 2, part 2 — Tag, Multi Select, Select Menu (Multi) and Menu Item (Multi) vs the Figma reference pack.
 *
 * Every expected number (sizes, paddings, gaps, radii, stroke weights, text styles, shadows, icon sizes and colours) and every
 * token binding is READ from design/figma/components/{tag,multi-select,select-menu,menu-item,checkbox}.json for the variant
 * under test, EN and FA; resolved colours come from tokens/figma.tokens.json. Nothing is copied by hand. Text WIDTHS are
 * not compared (Geist/Vazirmatn differ from Figma's fonts by a pixel or two); pixels are in pack-visual-multi-select.spec.ts.
 *
 * FA: Figma reverses the order of the tags by hand; the code uses real RTL flow. So the FA checks compare positions from the
 * inline START edge and the visual order (first tag first), exactly like the FA frames read.
 */
import { expect, test, type Locator } from '@playwright/test';
import { box, open, shadows, style, token } from './support/figma';
import { effectLayers, fillToken, gap, layer, paddings, shown, strokeToken, strokeWeight, textCss, variant, type Node } from './support/pack';
import { figmaEnd, figmaStart, LABEL_OF, LOCALES, openMenu, paramsFor, SIZES, STATES, tagsOf, tagVariantProps } from './support/multi-select';

test.use({ reducedMotion: 'reduce' });

const near = (actual: number, expected: number, tolerance = 0.51) => expect(Math.abs(actual - expected), `${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
const px = (n: number) => `${n}px`;

async function offsets(root: Locator, el: Locator, dir: 'ltr' | 'rtl') {
  const r = await box(root);
  const b = await box(el);
  return { start: dir === 'rtl' ? r.x + r.width - (b.x + b.width) : b.x - r.x, end: dir === 'rtl' ? b.x - r.x : r.x + r.width - (b.x + b.width), top: b.y - r.y, width: b.width, height: b.height };
}
// ── Tag ────────────────────────────────────────────────────────────────────────────────────────────────
test.describe('Tag (pack: tag.json)', () => {
  for (const loc of LOCALES) {
    for (const size of ['Small', 'Medium'] as const) {
      for (const state of ['Default', 'Hover', 'Disabled'] as const) {
        test(`${loc.name} · ${size} · ${state}: size, padding, gap, radius, fill, stroke, text, remove icon`, async ({ page }) => {
          const v = variant('tag', { Locale: loc.name, Size: size, State: state });
          const root = v.node;
          const label = layer(root, 'Label');
          const remove = layer(root, 'Remove');
          const stage = await open(page, {
            c: 'tag',
            dir: loc.dir,
            size: size === 'Small' ? 'sm' : 'md',
            state: state === 'Disabled' ? 'disabled' : 'default',
            label: label.text?.characters ?? '',
          });
          const tag = stage.locator('[data-slot=fy-tag]');
          if (state === 'Hover') await tag.hover();

          const b = await box(tag);
          near(b.height, root.height);
          // the width is the text (fonts differ slightly) + the paddings, the gap and the 12px button
          near(b.width, root.width, loc.dir === 'rtl' ? 8 : 3); // Vazirmatn vs IRANYekanX text widths

          const s = await style(tag, ['border-top-left-radius', 'border-top-width', 'border-top-color', 'background-color', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'column-gap']);
          const [pt, pr, pb, pl] = paddings(root);
          expect(s['border-top-left-radius']).toBe(px(root.cornerRadius as number));
          expect(s['border-top-width']).toBe(px(strokeWeight(root)));
          expect(s['border-top-color']).toBe(token(strokeToken(root) as string));
          expect(s['background-color']).toBe(token(fillToken(root) as string));
          expect([s['padding-top'], s['padding-right'], s['padding-bottom'], s['padding-left']]).toEqual([px(pt), px(pr), px(pb), px(pl)]);
          expect(s['column-gap']).toBe(px(gap(root)));

          const text = tag.locator('span').first();
          const t = textCss(label);
          const ts = await style(text, ['font-size', 'font-weight', 'line-height', 'color']);
          expect(ts).toEqual({ 'font-size': t.fontSize, 'font-weight': t.fontWeight, 'line-height': t.lineHeight, color: token(t.color as string) });

          const button = tag.getByRole('button', { name: /^.+/ });
          const rb = await box(button);
          expect([rb.width, rb.height]).toEqual([remove.width, remove.height]);
          expect(remove.icon?.name).toBe('close-circle');
          await expect(button.locator('svg')).toHaveAttribute('data-fyldo-icon', 'closecircle');
          expect((await style(button, ['color'])).color).toBe(token(remove.icon?.colour as string)); // icon/tertiary, icon/primary on hover, text/disabled
          // the remove button is the LAST thing before the end padding, vertically centred
          const tb = await offsets(tag, button, loc.dir);
          near(tb.end - strokeWeight(root), loc.dir === 'ltr' ? pr : pl, 0.51); // the END padding
          near(tb.top, remove.y);
          if (state === 'Disabled') await expect(button).toBeDisabled();
        });
      }
    }
  }

  for (const loc of LOCALES) {
    test(`${loc.name}: the non-removable overflow "+n" chip has the same frame and no button`, async ({ page }) => {
      const v = variant('multi-select', { Locale: loc.name, Size: 'Small', State: 'Filled' });
      const overflow = tagsOf(layer(v.node, 'Values'), v.node, loc.dir).overflow as Node;
      const chip = variant('tag', { Locale: loc.name, Size: 'Small', State: 'Default' }).node;
      const stage = await open(page, { c: 'tag', dir: loc.dir, size: 'sm', removable: '0', label: LABEL_OF(overflow) });
      const tag = stage.locator('[data-slot=fy-tag]');
      await expect(tag.getByRole('button')).toHaveCount(0);
      await expect(tag).toContainText(LABEL_OF(overflow));
      const b = await box(tag);
      near(b.height, overflow.height);
      near(b.width, overflow.width, 2); // "+1" is ~12px wide at Label/12; Figma keeps the 6/4 padding even without a button
      const s = await style(tag, ['padding-left', 'padding-right', 'background-color']);
      const [, pr, , pl] = paddings(chip);
      expect([s['padding-left'], s['padding-right']]).toEqual([px(pl), px(pr)]); // the pack's own (physical) numbers, FA frames included
      expect(s['background-color']).toBe(token(fillToken(chip) as string));
      expect(overflow.instance?.componentProperties['Removable#9:26']?.value).toBe(false);
    });
  }
});

// ── Multi Select (the field) ───────────────────────────────────────────────────────────────────────────
test.describe('Multi Select (pack: multi-select.json)', () => {
  for (const loc of LOCALES) {
    for (const size of SIZES) {
      for (const state of STATES) {
        test(`${loc.name} · ${size.name} · ${state}`, async ({ page }) => {
          const v = variant('multi-select', { Locale: loc.name, Size: size.name, State: state });
          const root = v.node;
          const control = layer(root, 'Control');
          const values = layer(control, 'Values');
          const icons = layer(control, 'Icons');
          const stage = await open(page, paramsFor(loc, root, size.code, state));
          const field = stage.getByRole('combobox', { name: layer(root, 'Label').text?.characters ?? '' });
          if (state === 'Hover') await field.hover();
          if (state === 'Focus') await page.keyboard.press('Tab');
          if (state === 'Open') {
            await field.click();
            await page.locator('[data-slot=fy-multi-select-menu]').waitFor();
            await page.mouse.move(0, 0);
          }

          // ── the stack: label · control · helper/error row ──
          near((await box(stage)).height, root.height);
          const label = layer(root, 'Label');
          const labelEl = stage.locator('label');
          const l = await offsets(stage, labelEl, loc.dir);
          near(l.top, label.y);
          const lt = textCss(label);
          expect(await style(labelEl, ['font-size', 'font-weight', 'line-height', 'color'])).toEqual({ 'font-size': lt.fontSize, 'font-weight': lt.fontWeight, 'line-height': lt.lineHeight, color: token(lt.color as string) });

          // ── the control frame ──
          const c = await offsets(stage, field, loc.dir);
          near(c.width, control.width);
          near(c.height, control.height);
          near(c.top, control.y);
          const s = await style(field, [
            'border-top-left-radius', 'border-top-width', 'border-top-color', 'background-color', 'box-shadow',
            'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'column-gap',
          ]);
          const [pt, pr, pb, pl] = paddings(control);
          expect(s['border-top-left-radius']).toBe(px(control.cornerRadius as number));
          expect(s['border-top-width']).toBe(px(strokeWeight(control)));
          expect(s['border-top-color']).toBe(token(strokeToken(control) as string));
          expect(s['background-color']).toBe(token(fillToken(control) as string));
          expect(shadows(s['box-shadow'] as string)).toEqual(effectLayers(control)); // Focus/Input on Focus and Open, Focus/Input Error on Error
          expect([s['padding-top'], s['padding-right'], s['padding-bottom'], s['padding-left']]).toEqual([px(pt), px(pr), px(pb), px(pl)]);
          expect(s['column-gap']).toBe(px(gap(control)));

          // ── the values: placeholder, or wrapping tags + the non-removable "+n" ──
          const valuesEl = field.locator('[data-slot=fy-multi-values]');
          const vs = await style(valuesEl, ['column-gap', 'row-gap', 'flex-wrap', 'min-height']);
          expect([vs['column-gap'], vs['row-gap'], vs['flex-wrap']]).toEqual([px(gap(values)), px(gap(values)), 'wrap']);
          near(parseFloat(vs['min-height'] as string), (values.layout?.minHeight as number | undefined) ?? values.height, 0.01); // Figma: the Values frame is min 20 (Small) / 24 (Medium, Large) tall

          if (shown(control, 'Placeholder')) {
            const placeholder = layer(control, 'Placeholder');
            const p = textCss(placeholder);
            const pe = field.getByText(placeholder.text?.characters ?? '', { exact: true });
            expect(await style(pe, ['font-size', 'font-weight', 'line-height', 'color'])).toEqual({ 'font-size': p.fontSize, 'font-weight': p.fontWeight, 'line-height': p.lineHeight, color: token(p.color as string) });
            await expect(field.locator('[data-slot=fy-tag]')).toHaveCount(0);
          } else {
            const { tags, overflow } = tagsOf(values, root, loc.dir);
            const rendered = field.locator('[data-slot=fy-tag]');
            await expect(rendered).toHaveCount(tags.length + (overflow ? 1 : 0));
            const first = await offsets(stage, rendered.first(), loc.dir);
            near(first.start, figmaStart(root, tags[0] as Node, loc.dir), 0.51);
            near(first.top, (tags[0] as Node).y, 0.51);
            let previousEnd: number | null = null;
            for (let i = 0; i < tags.length; i++) {
              const pack = tags[i] as Node;
              const tagEl = rendered.nth(i);
              await expect(tagEl).toContainText(LABEL_OF(pack));
              const tb = await offsets(stage, tagEl, loc.dir);
              near(tb.height, pack.height);
              near(tb.width, pack.width, loc.dir === 'rtl' ? 8 : 3);
              // tag size follows the Figma variant: Small field → Small tags, Medium and Large → Medium tags
              expect(await tagEl.getAttribute('data-size')).toBe(tagVariantProps(pack).Size === 'Small' ? 'sm' : 'md');
              // the 4px gap between neighbours (real RTL flow: the first tag is at the start in both directions)
              if (previousEnd !== null) near(tb.start - previousEnd, gap(values), 0.51);
              previousEnd = tb.start + tb.width;
              await expect(tagEl.getByRole('button', { name: `${loc.name === 'FA' ? 'حذف' : 'Remove'} ${LABEL_OF(pack)}` })).toHaveCount(1);
            }
            if (overflow) {
              const chip = rendered.nth(tags.length);
              await expect(chip.getByRole('button')).toHaveCount(0); // non-removable
              await expect(chip).toContainText(LABEL_OF(overflow));
              const cb = await offsets(stage, chip, loc.dir);
              near(cb.height, overflow.height);
              near(cb.start - (previousEnd as number), gap(values), 0.51);
            }
          }

          // ── the chevron: 16px, at the end, beside the first line ──
          const chevron = layer(icons, 'Chevron');
          const chevronEl = stage.locator('[data-slot=fy-multi-icons] svg:visible').last();
          const cv = await offsets(stage, chevronEl, loc.dir);
          expect([cv.width, cv.height]).toEqual([chevron.width, chevron.height]);
          near(cv.end, figmaEnd(root, chevron, loc.dir), 0.51);
          near(cv.top, chevron.y, 1.01); // (FA placeholders are 24px tall in a 20px icon frame: Figma's own offsets)
          // Figma calls the components arrow-down / arrow-up; their geometry is the package's ArrowDown2 / ArrowUp2 (design-spec §4)
          expect(chevron.icon?.name).toBe(state === 'Open' ? 'arrow-up' : 'arrow-down');
          await expect(chevronEl).toHaveAttribute('data-fyldo-icon', state === 'Open' ? 'arrowup2' : 'arrowdown2');
          expect((await style(chevronEl, ['color'])).color).toBe(token(chevron.icon?.colour as string));

          // ── helper / error ──
          if (state === 'Error') {
            const message = layer(root, 'Error message');
            const mt = textCss(message);
            expect(await style(stage.getByText(message.text?.characters ?? ''), ['font-size', 'line-height', 'color'])).toEqual({ 'font-size': mt.fontSize, 'line-height': mt.lineHeight, color: token(mt.color as string) });
            await expect(stage.locator('[data-slot=fy-field-error] svg')).toHaveAttribute('data-fyldo-icon', 'infocircle');
            await expect(field).toHaveAttribute('aria-invalid', 'true');
          } else if (state !== 'Open') {
            const helper = layer(root, 'Helper text');
            const ht = textCss(helper);
            // The pack draws a Disabled helper in text/disabled (3.23:1 on white); it carries the reason a field is
            // disabled, so it keeps text/secondary (design-spec §10.2, an M5 accessibility fix).
            const color = state === 'Disabled' ? token('text/secondary') : token(ht.color as string);
            expect(await style(stage.getByText(helper.text?.characters ?? ''), ['font-size', 'line-height', 'color'])).toEqual({ 'font-size': ht.fontSize, 'line-height': ht.lineHeight, color });
          }
          if (state === 'Disabled') await expect(field).toHaveAttribute('aria-disabled', 'true');
        });
      }
    }
  }

  // The pack's "Clear button" property is off in every exported variant; its layer (16px close-circle, icon/tertiary, before the
  // chevron in the Icons frame with the frame's 8px gap) is still in the tree and is what the button is built from.
  for (const loc of LOCALES) {
    test(`${loc.name}: the Clear button is the pack's Clear layer, 8px before the chevron`, async ({ page }) => {
      const v = variant('multi-select', { Locale: loc.name, Size: 'Small', State: 'Filled' });
      const icons = layer(layer(v.node, 'Control'), 'Icons');
      const clear = layer(icons, 'Clear');
      const stage = await open(page, paramsFor(loc, v.node, 'sm', 'Filled', { clear: '1' }));
      const button = stage.locator('[data-slot=fy-multi-clear]');
      const b = await box(button);
      expect([b.width, b.height]).toEqual([clear.width, clear.height]);
      await expect(button.locator('svg')).toHaveAttribute('data-fyldo-icon', 'closecircle');
      expect(clear.icon?.name).toBe('close-circle');
      expect((await style(button, ['color'])).color).toBe(token(clear.icon?.colour as string));
      const c = await offsets(stage, button, loc.dir);
      const chev = await offsets(stage, stage.locator('[data-slot=fy-multi-icons] svg:visible').last(), loc.dir);
      near(chev.start - (c.start + c.width), gap(icons), 0.51);
      near(c.top, chev.top, 0.51); // both 16px, centred in the one-line Icons frame (the hidden layer's own y is not laid out)
      await expect(button).toHaveAccessibleName(loc.name === 'FA' ? 'پاک کردن همه' : 'Clear all');
      // the button is drawn only while there is something to clear
      await button.click();
      await expect(button).toHaveCount(0);
      await expect(stage.locator('[data-slot=fy-tag]')).toHaveCount(0);
      expect(await page.locator('[data-slot=fy-multi-select-menu]').count()).toBe(0);
    });
  }

  test('a wider selection wraps onto more lines: the control grows, the chevron stays beside the first line', async ({ page }) => {
    const v = variant('multi-select', { Locale: 'EN', Size: 'Small', State: 'Filled' });
    const control = layer(v.node, 'Control');
    const tag = tagsOf(layer(control, 'Values'), v.node, 'ltr').tags[0] as Node;
    const options = Array.from({ length: 6 }, (_, i) => `o${i}:A rather long option name ${i + 1}`);
    const stage = await open(page, {
      c: 'multi-select',
      label: 'Show on',
      options: options.join('|'),
      value: options.map((_, i) => `o${i}`).join(','),
      max: '6',
    });
    const field = stage.getByRole('combobox');
    const b = await box(field);
    expect(b.height).toBeGreaterThan(control.height + tag.height); // at least two rows
    const rows = new Set<number>();
    for (const t of await field.locator('[data-slot=fy-tag]').all()) rows.add(Math.round((await box(t)).y));
    expect(rows.size).toBeGreaterThan(1);
    const rowsSorted = [...rows].sort((a, c) => a - c);
    near((rowsSorted[1] as number) - (rowsSorted[0] as number), tag.height + gap(layer(control, 'Values')), 0.51); // 4px between rows
    const chevron = layer(layer(control, 'Icons'), 'Chevron');
    near((await offsets(field, stage.locator('[data-slot=fy-multi-icons] svg:visible').last(), 'ltr')).top, chevron.y - control.y, 1.01);
  });
});

// ── Select Menu (Multi) and Menu Item (Multi) ──────────────────────────────────────────────────────────
test.describe('Select Menu · Multi (pack: select-menu.json)', () => {
  for (const loc of LOCALES) {
    test(`${loc.name}: the popup frame, Search row, six options and the Footer`, async ({ page }) => {
      const v = variant('select-menu', { Locale: loc.name, Type: 'Multi' });
      const root = v.node;
      const { stage, popup, items } = await openMenu(page, loc, root, {});
      await page.locator('[role=option]').nth(4).hover(); // Figma shows Item 5 in its Hover state

      // ── frame ──
      const pb = await box(popup);
      near(pb.width, root.width);
      near(pb.height, root.height);
      const ps = await style(popup, ['border-top-left-radius', 'border-top-width', 'border-top-color', 'background-color', 'box-shadow', 'overflow-y']);
      expect(ps['border-top-left-radius']).toBe(px(root.cornerRadius as number));
      expect(ps['border-top-width']).toBe(px(strokeWeight(root)));
      expect(ps['border-top-color']).toBe(token(strokeToken(root) as string));
      expect(ps['background-color']).toBe(token(fillToken(root) as string));
      expect(shadows(ps['box-shadow'] as string)).toEqual(effectLayers(root)); // Shadow/Medium
      // 4px below the field, as wide as the field
      const field = await box(stage.getByRole('combobox'));
      near(pb.y - (field.y + field.height), 4);
      near(pb.width, field.width);

      // ── Search ──
      const search = layer(root, 'Search');
      const searchEl = popup.locator('[data-slot=fy-multi-search]');
      const sb = await offsets(popup, searchEl, loc.dir);
      near(sb.top, search.y);
      near(sb.height, search.height);
      const ss = await style(searchEl, ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'column-gap', 'border-bottom-width', 'border-bottom-color', 'border-top-width']);
      const [st, sr, sbm, sl] = paddings(search);
      expect([ss['padding-top'], ss['padding-right'], ss['padding-bottom'], ss['padding-left']]).toEqual([px(st), px(sr), px(sbm), px(sl)]);
      expect(ss['column-gap']).toBe(px(gap(search)));
      expect(ss['border-bottom-width']).toBe(px(search.strokes?.weight ? 1 : 0)); // only the bottom edge has a stroke
      expect(ss['border-bottom-color']).toBe(token(strokeToken(search) as string));
      expect(ss['border-top-width']).toBe('0px');
      const icon = layer(search, 'Search icon');
      const iconEl = searchEl.locator('svg');
      const ib = await offsets(popup, iconEl, loc.dir);
      expect([ib.width, ib.height]).toEqual([icon.width, icon.height]);
      near(ib.start, figmaStart(root, icon, loc.dir), 1.01);
      await expect(iconEl).toHaveAttribute('data-fyldo-icon', 'searchnormal');
      expect((await style(iconEl, ['color'])).color).toBe(token(icon.icon?.colour as string));
      const placeholder = layer(search, 'Search placeholder');
      const input = searchEl.getByRole('combobox');
      await expect(input).toHaveAttribute('placeholder', placeholder.text?.characters ?? '');
      const pt = textCss(placeholder);
      expect(await style(input, ['font-size', 'font-weight', 'line-height'])).toEqual({ 'font-size': pt.fontSize, 'font-weight': pt.fontWeight, 'line-height': pt.lineHeight });

      // ── Options ──
      const options = layer(root, 'Options');
      const rendered = page.locator('[role=option]');
      await expect(rendered).toHaveCount(6);
      const list = await style(page.locator('[role=listbox]'), ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'row-gap']);
      const [ot, or, ob, ol] = paddings(options);
      expect([list['padding-top'], list['padding-right'], list['padding-bottom'], list['padding-left']]).toEqual([px(ot), px(or), px(ob), px(ol)]);
      expect(list['row-gap']).toBe(px(gap(options)));
      for (let i = 0; i < 6; i++) {
        const item = items[i] as Node;
        const ib2 = await offsets(popup, rendered.nth(i), loc.dir);
        near(ib2.top, item.y, 0.51);
        near(ib2.height, item.height);
        near(ib2.width, item.width, 0.51);
        near(ib2.start, figmaStart(root, item, loc.dir), 0.51);
        const is = await style(rendered.nth(i), ['border-top-left-radius', 'background-color']);
        expect(is['border-top-left-radius']).toBe(px(item.cornerRadius as number));
        // Item 5 is Hover (fill surface/default); the others have no fill
        expect(is['background-color']).toBe(item.fills?.[0]?.token ? token(item.fills[0].token) : 'rgba(0, 0, 0, 0)');
        await expect(rendered.nth(i)).toHaveAttribute('aria-selected', i < 4 ? 'true' : 'false');
        if (i === 5) await expect(rendered.nth(i)).toHaveAttribute('aria-disabled', 'true');
      }

      // ── Footer ──
      const footer = layer(root, 'Footer');
      const footerEl = popup.locator('[data-slot=fy-multi-footer]');
      const fb = await offsets(popup, footerEl, loc.dir);
      near(fb.top, footer.y);
      near(fb.height, footer.height);
      near(fb.width, footer.width);
      const fs = await style(footerEl, ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'column-gap', 'background-color', 'border-top-width', 'border-top-color', 'border-bottom-width']);
      const [ft, fr, fbm, fl] = paddings(footer);
      expect([fs['padding-top'], fs['padding-right'], fs['padding-bottom'], fs['padding-left']]).toEqual([px(ft), px(fr), px(fbm), px(fl)]);
      expect(fs['column-gap']).toBe(px(gap(footer)));
      expect(fs['background-color']).toBe(token(fillToken(footer) as string));
      expect(fs['border-top-width']).toBe('1px');
      expect(fs['border-top-color']).toBe(token(strokeToken(footer) as string));
      expect(fs['border-bottom-width']).toBe('0px');

      const count = layer(footer, 'Count');
      const countEl = footerEl.getByText(count.text?.characters ?? '', { exact: true }); // "4 selected" / "۴ مورد انتخاب شده"
      await expect(countEl).toBeVisible();
      const ct = textCss(count);
      expect(await style(countEl, ['font-size', 'font-weight', 'line-height', 'color'])).toEqual({ 'font-size': ct.fontSize, 'font-weight': ct.fontWeight, 'line-height': ct.lineHeight, color: token(ct.color as string) });
      const clear = layer(footer, 'Clear button');
      const clearEl = footerEl.getByRole('button');
      await expect(clearEl).toHaveText(clear.instance?.texts.Label ?? '');
      expect(clear.instance?.variant).toContain('Type=Tertiary, Size=Small');
      expect(await clearEl.getAttribute('data-variant')).toBe('tertiary');
      expect(await clearEl.getAttribute('data-size')).toBe('sm');
      const cb = await offsets(popup, clearEl, loc.dir);
      near(cb.height, clear.height);
      near(cb.end, figmaEnd(root, clear, loc.dir), 1.01); // 4px from the end edge (+1 border)
      near(cb.top, clear.y, 0.51);
    });
  }

  test('Figma Select Menu `Search` and `Footer` are separate parts: off, the popup is just the options', async ({ page }) => {
    const v = variant('select-menu', { Locale: 'EN', Type: 'Multi' });
    const { popup } = await openMenu(page, LOCALES[0], v.node, { search: '0', footer: '0' });
    await expect(popup.locator('[data-slot=fy-multi-footer]')).toHaveCount(0);
    const searchBox = await box(popup.locator('[data-slot=fy-multi-search]'));
    expect(searchBox.width).toBeLessThanOrEqual(1); // visually hidden, kept for assistive technology
    const popupBox = await box(popup);
    const options = layer(v.node, 'Options');
    near(popupBox.height, 2 + options.height); // border + the options frame
  });
});

test.describe('Menu Item · Multi (pack: menu-item.json + checkbox.json)', () => {
  const CASES = [
    { state: 'Selected', item: 0, checked: 'True', box: 'Default' },
    { state: 'Hover', item: 4, checked: 'False', box: 'Hover' },
    { state: 'Disabled', item: 5, checked: 'False', box: 'Disabled' },
  ] as const;

  for (const loc of LOCALES) {
    for (const c of CASES) {
      test(`${loc.name} · ${c.state}: leading checkbox, label, fill`, async ({ page }) => {
        const menu = variant('select-menu', { Locale: loc.name, Type: 'Multi' }).node;
        const v = variant('menu-item', { Locale: loc.name, Type: 'Multi', State: c.state });
        const root = v.node;
        const cbVariant = variant('checkbox', { Locale: loc.name, Checked: c.checked, State: c.box }).node;
        const boxLayer = layer(cbVariant, 'Control', 'Box');
        const { popup } = await openMenu(page, loc, menu, {});
        const item = page.locator('[role=option]').nth(c.item);
        // Base UI highlights an option (the fill of Hover); park the highlight on another row so Selected / Disabled are idle
        await page.locator('[role=option]').nth(c.state === 'Hover' ? c.item : 3).hover();

        const ib = await box(item);
        near(ib.height, root.height);
        const s = await style(item, ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'column-gap', 'border-top-left-radius', 'background-color']);
        const [pt, pr, pb, pl] = paddings(root);
        expect([s['padding-top'], s['padding-right'], s['padding-bottom'], s['padding-left']]).toEqual([px(pt), px(pr), px(pb), px(pl)]);
        expect(s['column-gap']).toBe(px(gap(root)));
        expect(s['border-top-left-radius']).toBe(px(root.cornerRadius as number));
        expect(s['background-color']).toBe(root.fills?.[0]?.token ? token(root.fills[0].token) : 'rgba(0, 0, 0, 0)');

        // the 16px checkbox: same box as the Checkbox component in the matching state
        const mark = item.locator('[data-slot=fy-checkbox]');
        const mb = await offsets(item, mark, loc.dir);
        expect([mb.width, mb.height]).toEqual([boxLayer.width, boxLayer.height]);
        near(mb.start, pl, 0.51);
        const ms = await style(mark, ['border-top-left-radius', 'border-top-width', 'border-top-color', 'background-color']);
        expect(ms['border-top-left-radius']).toBe(px(boxLayer.cornerRadius as number));
        expect(ms['background-color']).toBe(token(fillToken(boxLayer) as string));
        expect(ms['border-top-width']).toBe(px(strokeWeight(boxLayer)));
        if (strokeToken(boxLayer)) expect(ms['border-top-color']).toBe(token(strokeToken(boxLayer) as string));
        await expect(mark.locator('svg')).toHaveCount(c.checked === 'True' ? 1 : 0);

        // the label
        const label = layer(root, 'Label');
        const labelEl = item.getByText(LABEL_OF(layer(menu, `Item ${c.item + 1}`)), { exact: true });
        const lt = textCss(label);
        expect(await style(labelEl, ['font-size', 'font-weight', 'line-height', 'color'])).toEqual({ 'font-size': lt.fontSize, 'font-weight': lt.fontWeight, 'line-height': lt.lineHeight, color: token(lt.color as string) });
        const lb = await offsets(item, labelEl, loc.dir);
        near(lb.start - (mb.start + mb.width), gap(root), 0.51);
        expect(shown(root, 'Check')).toBe(false); // Multi rows show the checkbox, never the trailing tick
        await expect(item.locator('[data-fyldo-icon=tickcircle]')).toHaveCount(0);
        await expect(popup).toBeVisible();
      });
    }

    test(`${loc.name} · Default: an unselected, idle row`, async ({ page }) => {
      const menu = variant('select-menu', { Locale: loc.name, Type: 'Multi' }).node;
      const v = variant('menu-item', { Locale: loc.name, Type: 'Multi', State: 'Default' });
      const boxLayer = layer(variant('checkbox', { Locale: loc.name, Checked: 'False', State: 'Default' }).node, 'Control', 'Box');
      await openMenu(page, loc, menu, { value: 'o0' });
      await page.mouse.move(0, 0);
      const item = page.locator('[role=option]').nth(3);
      const s = await style(item, ['background-color']);
      expect(s['background-color']).toBe(v.node.fills?.[0]?.token ? token(v.node.fills[0].token) : 'rgba(0, 0, 0, 0)');
      const ms = await style(item.locator('[data-slot=fy-checkbox]'), ['border-top-color', 'background-color']);
      expect(ms['background-color']).toBe(token(fillToken(boxLayer) as string));
      expect(ms['border-top-color']).toBe(token(strokeToken(boxLayer) as string));
    });

    test(`${loc.name}: an option with an icon draws it between the checkbox and the label (Figma "Leading icon")`, async ({ page }) => {
      const v = variant('menu-item', { Locale: loc.name, Type: 'Multi', State: 'Default' });
      const icon = layer(v.node, 'Leading icon');
      const stage = await open(page, { c: 'multi-select', dir: loc.dir, label: 'Languages', options: 'en:English:::global|fa:Persian', value: '', max: '0' });
      await stage.getByRole('combobox').click();
      const item = page.locator('[role=option]').first();
      const svg = item.locator('[data-fyldo-icon=global]');
      const b = await offsets(item, svg, loc.dir);
      expect([b.width, b.height]).toEqual([icon.width, icon.height]);
      expect((await style(svg, ['color'])).color).toBe(token(icon.icon?.colour as string));
      const mark = await offsets(item, item.locator('[data-slot=fy-checkbox]'), loc.dir);
      near(b.start - (mark.start + mark.width), gap(v.node), 0.51);
    });
  }
});
