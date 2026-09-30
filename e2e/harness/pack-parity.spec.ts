/**
 * Milestone 2 components vs the Figma reference pack (design/figma/components/*.json).
 *
 * Every expected number — sizes, paddings, gaps, radii, stroke weights, text styles, shadows — and every token binding
 * is READ from the pack for the variant under test (EN and FA); resolved colours come from tokens/figma.tokens.json.
 * Nothing is copied by hand. Text WIDTHS are not compared (Geist/Vazirmatn metrics differ from Figma's by a pixel or two);
 * the pixel comparison lives in pack-visual.spec.ts.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { box, open, shadows, style, token, TRANSPARENT } from './support/figma';
import { digits, effectLayers, fillToken, gap, layer, paddings, shown, strokeToken, strokeWeight, textCss, variant, type Node } from './support/pack';

test.use({ reducedMotion: 'reduce' });

const LOCALES = [
  { name: 'EN', dir: 'ltr' },
  { name: 'FA', dir: 'rtl' },
] as const;
type Locale = (typeof LOCALES)[number];

const near = (actual: number, expected: number, tolerance = 0.51) => expect(Math.abs(actual - expected), `${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
const px = (n: number) => `${n}px`;

/** Position of `el` inside `root`, measured from the inline START edge (left in LTR, right in RTL) — like Figma's mirrored FA frames. */
async function offsets(root: Locator, el: Locator, dir: 'ltr' | 'rtl') {
  const r = await box(root);
  const b = await box(el);
  return { start: dir === 'rtl' ? r.x + r.width - (b.x + b.width) : b.x - r.x, top: b.y - r.y, width: b.width, height: b.height };
}

/** Figma's offset of a layer from the inline start edge of the component (FA frames are laid out right-to-left). */
const figmaStart = (root: Node, n: Node, dir: 'ltr' | 'rtl') => (dir === 'rtl' ? root.width - (n.x + n.width) : n.x);

// ── Textarea ───────────────────────────────────────────────────────────────────────────────────────────
const TEXTAREA_STATES = ['Default', 'Hover', 'Focus', 'Filled', 'Error', 'Disabled'] as const;

async function openTextarea(page: Page, loc: Locale, state: (typeof TEXTAREA_STATES)[number]) {
  const v = variant('textarea', { Locale: loc.name, State: state });
  const root = v.node;
  const control = layer(root, 'Control');
  const counter = layer(root, 'Counter');
  const [count = 0, limit = 0] = digits(counter.text?.characters ?? '');
  const valueLayer = shown(control, 'Value') ? layer(control, 'Value') : null;
  const params: Record<string, string> = {
    c: 'textarea',
    dir: loc.dir,
    state: state === 'Error' ? 'error' : state === 'Disabled' ? 'disabled' : 'default',
    label: layer(root, 'Label').text?.characters ?? '',
    placeholder: shown(control, 'Placeholder') ? (layer(control, 'Placeholder').text?.characters ?? '') : '',
    value: valueLayer?.text?.characters ?? '',
    helper: shown(root, 'Helper text') ? (layer(root, 'Helper text').text?.characters ?? '') : '',
    error: shown(root, 'Error message') ? (layer(root, 'Error message').text?.characters ?? '') : '',
    count: String(count),
    limit: String(limit),
  };
  const stage = await open(page, params);
  return { v, root, control, counter, stage, textarea: stage.getByRole('textbox'), wrapper: stage.locator('[data-slot=fy-textarea]') };
}

test.describe('Textarea (pack: textarea.json)', () => {
  for (const loc of LOCALES) {
    for (const state of TEXTAREA_STATES) {
      test(`${loc.name} · ${state}: control, label, helper row, counter`, async ({ page }) => {
        const { root, control, counter, stage, textarea, wrapper } = await openTextarea(page, loc, state);
        if (state === 'Hover') await wrapper.hover();
        if (state === 'Focus') await page.keyboard.press('Tab');

        // ── the control frame: size, radius, fill, stroke, padding, halo ──
        const w = await box(wrapper);
        near(w.width, control.width);
        near(w.height, control.height);
        const s = await style(wrapper, ['border-top-left-radius', 'border-top-width', 'border-top-color', 'background-color', 'box-shadow']);
        expect(s['border-top-left-radius']).toBe(px(control.cornerRadius as number));
        expect(s['border-top-width']).toBe(px(strokeWeight(control)));
        expect(s['border-top-color']).toBe(token(strokeToken(control) as string));
        expect(s['background-color']).toBe(token(fillToken(control) as string));
        expect(shadows(s['box-shadow'] as string)).toEqual(effectLayers(control)); // Focus/Input, Focus/Input Error, or none

        const [pt, pr, pb, pl] = paddings(control);
        const p = await style(textarea, ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'resize']);
        expect([p['padding-top'], p['padding-right'], p['padding-bottom'], p['padding-left']]).toEqual([px(pt), px(pr), px(pb), px(pl)]);
        expect(p.resize).toBe('vertical'); // Figma: "Resize handle" is shown in every state

        // ── the typed text (placeholder or value) ──
        const text = shown(control, 'Value') ? layer(control, 'Value') : layer(control, 'Placeholder');
        const t = textCss(text);
        const ts = await style(textarea, ['font-size', 'font-weight', 'line-height', 'color']);
        expect(ts['font-size']).toBe(t.fontSize);
        expect(ts['font-weight']).toBe(t.fontWeight);
        expect(ts['line-height']).toBe(t.lineHeight);
        if (text.name === 'Value') expect(ts.color).toBe(token(t.color as string));

        // ── vertical rhythm of the whole stack: label · control · helper row ──
        const rootBox = await box(stage);
        near(rootBox.height, root.height);
        const label = layer(root, 'Label');
        const labelEl = stage.locator('label');
        const l = await offsets(stage, labelEl, loc.dir);
        near(l.top, label.y);
        near(l.height, label.height);
        const ls = await style(labelEl, ['font-size', 'font-weight', 'line-height', 'color']);
        const lt = textCss(label);
        expect(ls).toEqual({ 'font-size': lt.fontSize, 'font-weight': lt.fontWeight, 'line-height': lt.lineHeight, color: token(lt.color as string) });
        near((await offsets(stage, wrapper, loc.dir)).top, control.y);

        const footerLayer = shown(root, 'Error') ? layer(root, 'Error') : layer(root, 'Helper');
        const footer = await offsets(stage, stage.locator('[data-slot=fy-textarea-footer]'), loc.dir);
        near(footer.top, footerLayer.y);
        near(footer.height, footerLayer.height);

        // ── helper / error text ──
        if (state === 'Error') {
          const message = layer(root, 'Error message');
          const e = await style(stage.getByText(message.text?.characters ?? ''), ['font-size', 'line-height', 'color']);
          const mt = textCss(message);
          expect(e).toEqual({ 'font-size': mt.fontSize, 'line-height': mt.lineHeight, color: token(mt.color as string) });
          const icon = layer(root, 'Error icon');
          expect(icon.icon?.name).toBe('info-circle');
          const svg = stage.locator('[data-slot=fy-field-error] svg');
          const i = await box(svg);
          near(i.width, icon.width);
          near(i.height, icon.height);
          // the error REPLACES the helper text (same locale, Default variant)
          const helperText = layer(variant('textarea', { Locale: loc.name, State: 'Default' }).node, 'Helper text').text?.characters ?? '';
          await expect(stage.getByText(helperText)).toHaveCount(0);
        } else {
          const helper = layer(root, 'Helper text');
          const h = await style(stage.getByText(helper.text?.characters ?? ''), ['font-size', 'line-height', 'color']);
          const ht = textCss(helper);
          // The pack draws a Disabled helper in text/disabled (3.23:1 on white, an axe failure). The helper carries the
          // reason a field is disabled, so it keeps text/secondary (design-spec §10.2, an M5 accessibility fix).
          const color = state === 'Disabled' ? token('text/secondary') : token(ht.color as string);
          expect(h).toEqual({ 'font-size': ht.fontSize, 'line-height': ht.lineHeight, color });
        }

        // ── the counter: text, style, colour, and it sits at the END of the helper row ──
        const counterEl = stage.locator('[data-slot=fy-counter]');
        const numerals = (n: number) => (loc.dir === 'rtl' ? String(n).replace(/\d/g, (d) => String.fromCharCode(0x06f0 + Number(d))) : String(n));
        await expect(counterEl).toHaveText(`${numerals(digits(counter.text?.characters ?? '')[0] as number)}/${numerals(digits(counter.text?.characters ?? '')[1] as number)}`);
        const c = textCss(counter);
        const cs = await style(counterEl, ['font-size', 'font-weight', 'line-height', 'color', 'font-family']);
        expect(cs['font-size']).toBe(c.fontSize);
        expect(cs['font-weight']).toBe(c.fontWeight);
        expect(cs['line-height']).toBe(c.lineHeight);
        expect(cs.color).toBe(token(c.color as string));
        if (loc.dir === 'ltr') expect(cs['font-family']).toContain('Fyldo Geist Mono'); // EN/Mono/12
        const cb = await offsets(stage, counterEl, loc.dir);
        // the counter is the LAST item of the helper row: its end edge is the component's end edge (FA mirrored)
        near(figmaStart(root, counter, loc.dir) + counter.width, root.width, 0.01);
        near(cb.start + cb.width, root.width);
        expect(shown(root, 'Counter')).toBe(true);
      });
    }
  }

  test('the resize handle is only there while resize is on; it can be switched off', async ({ page }) => {
    const stage = await open(page, { c: 'textarea', label: 'Notes', resize: 'none' });
    expect((await style(stage.getByRole('textbox'), ['resize'])).resize).toBe('none');
  });

  test('rows: each extra row adds one 20px line to the Figma default (104px)', async ({ page }) => {
    const v = variant('textarea', { Locale: 'EN', State: 'Default' });
    const base = layer(v.node, 'Control').height;
    const line = textCss(layer(layer(v.node, 'Control'), 'Placeholder')).lineHeight;
    for (const rows of [4, 6, 8]) {
      const stage = await open(page, { c: 'textarea', label: 'Notes', rows: String(rows) });
      near((await box(stage.locator('[data-slot=fy-textarea]'))).height, base + (rows - 4) * parseFloat(line));
    }
  });

  test('over the limit: the error state, the counter turns red and the text is never cut', async ({ page }) => {
    const v = variant('textarea', { Locale: 'EN', State: 'Error' });
    const long = 'x'.repeat(172);
    const stage = await open(page, { c: 'textarea', state: 'error', label: 'Site description', error: 'Keep it under 160 characters.', value: long, limit: '160' });
    await expect(stage.locator('[data-slot=fy-counter]')).toHaveText('172/160');
    expect((await style(stage.locator('[data-slot=fy-counter]'), ['color'])).color).toBe(token(textCss(layer(v.node, 'Counter')).color as string));
    await expect(stage.getByRole('textbox')).toHaveValue(long);
  });
});

// ── Checkbox & Radio ───────────────────────────────────────────────────────────────────────────────────
const STATES = ['Default', 'Hover', 'Focus', 'Disabled'] as const;

async function press(page: Page, state: string, target: Locator) {
  if (state === 'Hover') await target.hover();
  if (state === 'Focus') await page.keyboard.press('Tab');
}

test.describe('Checkbox (pack: checkbox.json)', () => {
  for (const loc of LOCALES) {
    for (const checked of ['False', 'True', 'Indeterminate'] as const) {
      for (const state of STATES) {
        test(`${loc.name} · ${checked} · ${state}`, async ({ page }) => {
          const v = variant('checkbox', { Locale: loc.name, Checked: checked, State: state });
          const root = v.node;
          const boxLayer = layer(root, 'Control', 'Box');
          const label = layer(root, 'Label');
          const stage = await open(page, {
            c: 'checkbox',
            dir: loc.dir,
            checked: checked === 'True' ? '1' : checked === 'Indeterminate' ? 'indeterminate' : '0',
            state: state === 'Disabled' ? 'disabled' : 'default',
            label: label.text?.characters ?? '',
          });
          const checkbox = stage.getByRole('checkbox');
          await press(page, state, checkbox);

          // ── geometry: 16px box centred on the first text line (its slot is one text line tall) ──
          const rootBox = await box(stage);
          near(rootBox.height, root.height);
          const b = await offsets(stage, checkbox, loc.dir);
          expect([b.width, b.height]).toEqual([boxLayer.width, boxLayer.height]);
          near(b.top, boxLayer.y);
          near(b.start, figmaStart(root, boxLayer, loc.dir));

          // ── label: style, colour, gap ──
          const labelEl = stage.getByText(label.text?.characters ?? '', { exact: true });
          const lt = textCss(label);
          const ls = await style(labelEl, ['font-size', 'font-weight', 'line-height', 'color']);
          expect(ls).toEqual({ 'font-size': lt.fontSize, 'font-weight': lt.fontWeight, 'line-height': lt.lineHeight, color: token(lt.color as string) });
          const l = await offsets(stage, labelEl, loc.dir);
          near(l.start - (b.start + b.width), gap(root)); // 8px between the box and the text
          near(l.top, label.y);
          expect(shown(root, 'Description')).toBe(false); // "Show description" is off in every variant
          await expect(stage.getByText('Notify admins')).toHaveCount(0);

          // ── box: radius, fill, stroke ──
          const s = await style(checkbox, ['border-top-left-radius', 'border-top-width', 'border-top-color', 'background-color']);
          expect(s['border-top-left-radius']).toBe(px(boxLayer.cornerRadius as number));
          expect(s['background-color']).toBe(token(fillToken(boxLayer) as string));
          expect(s['border-top-width']).toBe(px(strokeWeight(boxLayer))); // unchecked: 1px inside stroke; checked: no stroke
          if (strokeToken(boxLayer)) expect(s['border-top-color']).toBe(token(strokeToken(boxLayer) as string));

          // ── the mark: geometry and stroke ──
          if (checked === 'False') {
            await expect(checkbox.locator('svg')).toHaveCount(0);
          } else {
            const mark = layer(boxLayer, checked === 'True' ? 'Check' : 'Dash');
            const path = checkbox.locator(`[data-glyph=${checked === 'True' ? 'check' : 'dash'}]`);
            await expect(path).not.toHaveCSS('display', 'none'); // (a 7×0 dash has no area, so Playwright's visibility check cannot be used)
            const g = await path.evaluate((el) => {
              const bb = (el as unknown as SVGGraphicsElement).getBBox();
              const cs = getComputedStyle(el);
              return { x: bb.x, y: bb.y, width: bb.width, height: bb.height, strokeWidth: cs.strokeWidth, stroke: cs.stroke };
            });
            near(g.x, mark.x - boxLayer.x, 0.05);
            near(g.y, mark.y - boxLayer.y, 0.05);
            near(g.width, mark.width, 0.05);
            near(g.height, mark.height, 0.05);
            expect(g.strokeWidth).toBe(px(mark.strokes?.weight as number));
            expect(g.stroke).toBe(token(strokeToken(mark) as string));
            await expect(checkbox.locator(`[data-glyph=${checked === 'True' ? 'dash' : 'check'}]`)).toHaveCSS('display', 'none');
          }

          // ── state: Figma's Focus variant is identical to Default (no indicator); the approved neutral ring (O5) is drawn on top ──
          if (state === 'Focus') {
            const ring = await style(checkbox, ['box-shadow']);
            expect(shadows(ring['box-shadow'] as string)).toEqual([`255,255,255,1 0px 0px 0px 2px`, expect.stringContaining(' 0px 0px 0px 4px')]);
            expect(ring['box-shadow']).toContain(token('focus/ring-neutral'));
            expect(ring['box-shadow']).not.toMatch(/0,\s*10[0-9],\s*245|0,\s*114,\s*245/); // never blue
          }
          if (state === 'Disabled') await expect(checkbox).toHaveAttribute('aria-disabled', 'true');
        });
      }
    }
  }

  test('Focus variants are pixel-identical to Default in Figma (the pack has no focus indicator — decision O5 adds it)', async () => {
    for (const checked of ['False', 'True', 'Indeterminate']) {
      const d = layer(variant('checkbox', { Locale: 'EN', Checked: checked, State: 'Default' }).node, 'Box');
      const f = layer(variant('checkbox', { Locale: 'EN', Checked: checked, State: 'Focus' }).node, 'Box');
      expect([fillToken(f), strokeToken(f), f.effects?.style]).toEqual([fillToken(d), strokeToken(d), d.effects?.style]);
    }
  });

  test('hovering the label darkens the box (the whole row is one target)', async ({ page }) => {
    const v = variant('checkbox', { Locale: 'EN', Checked: 'False', State: 'Hover' });
    const label = layer(v.node, 'Label').text?.characters ?? '';
    const stage = await open(page, { c: 'checkbox', checked: '0', label });
    await stage.getByText(label).hover();
    expect((await style(stage.getByRole('checkbox'), ['border-top-color']))['border-top-color']).toBe(token(strokeToken(layer(v.node, 'Box')) as string));
  });
});

test.describe('Radio (pack: radio.json)', () => {
  for (const loc of LOCALES) {
    for (const checked of ['False', 'True'] as const) {
      for (const state of STATES) {
        test(`${loc.name} · ${checked} · ${state}`, async ({ page }) => {
          const v = variant('radio', { Locale: loc.name, Checked: checked, State: state });
          const root = v.node;
          const circle = layer(root, 'Control', 'Circle');
          const label = layer(root, 'Label');
          const stage = await open(page, {
            c: 'radio',
            dir: loc.dir,
            checked: checked === 'True' ? '1' : '0',
            state: state === 'Disabled' ? 'disabled' : 'default',
            label: label.text?.characters ?? '',
          });
          const radio = stage.getByRole('radio');
          await press(page, state, radio);

          const rootBox = await box(stage);
          near(rootBox.height, root.height);
          const b = await offsets(stage, radio, loc.dir);
          expect([b.width, b.height]).toEqual([circle.width, circle.height]);
          near(b.top, circle.y);
          near(b.start, figmaStart(root, circle, loc.dir));

          const labelEl = stage.getByText(label.text?.characters ?? '', { exact: true });
          const lt = textCss(label);
          const ls = await style(labelEl, ['font-size', 'font-weight', 'line-height', 'color']);
          expect(ls).toEqual({ 'font-size': lt.fontSize, 'font-weight': lt.fontWeight, 'line-height': lt.lineHeight, color: token(lt.color as string) });
          const l = await offsets(stage, labelEl, loc.dir);
          near(l.start - (b.start + b.width), gap(root));
          near(l.top, label.y);

          const s = await style(radio, ['border-top-left-radius', 'border-top-width', 'border-top-color', 'background-color']);
          expect(s['border-top-left-radius']).toBe(px(circle.cornerRadius as number)); // radius/full
          expect(s['background-color']).toBe(token(fillToken(circle) as string));
          expect(s['border-top-width']).toBe(px(strokeWeight(circle)));
          if (strokeToken(circle)) expect(s['border-top-color']).toBe(token(strokeToken(circle) as string));

          if (checked === 'True') {
            const dot = layer(circle, 'Dot');
            const dotEl = radio.locator('[data-slot=fy-radio-dot]');
            const d = await box(dotEl);
            const rb = await box(radio);
            expect([d.width, d.height]).toEqual([dot.width, dot.height]);
            near(d.x - rb.x, dot.x - circle.x);
            near(d.y - rb.y, dot.y - circle.y);
            expect((await style(dotEl, ['background-color']))['background-color']).toBe(token(fillToken(dot) as string));
            expect((await style(dotEl, ['border-top-left-radius']))['border-top-left-radius']).not.toBe(TRANSPARENT);
          } else {
            await expect(radio.locator('[data-slot=fy-radio-dot]')).toHaveCount(0);
          }

          if (state === 'Focus') {
            const ring = await style(radio, ['box-shadow']);
            expect(ring['box-shadow']).toContain(token('focus/ring-neutral'));
          }
        });
      }
    }
  }
});
