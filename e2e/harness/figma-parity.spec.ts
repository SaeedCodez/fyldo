/**
 * Fyldo components vs the Figma file (Pg3Ni7eqTLQYIG6hfNVPt6). Expected numbers come from the component sets
 * (measured through the figma-console MCP, see docs/design-spec.md §4); expected COLOURS are resolved from the Figma
 * variable snapshot, so they follow the design file, not this test.
 *
 * Text WIDTHS are not compared exactly (Geist rendering differs by a pixel or two between Figma and Chrome); every
 * other dimension, radius, padding, gap and colour is.
 */
import { expect, test, type Page } from '@playwright/test';
import { box, open, shadow, shadows, style, token, TRANSPARENT } from './support/figma';

// Colours are compared at rest: no transition may be mid-flight when a hover/focus state is read.
test.use({ reducedMotion: 'reduce' });

const near = (actual: number, expected: number, tolerance = 0.51) => expect(Math.abs(actual - expected), `${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);

// ── Button ─────────────────────────────────────────────────────────────────────────────────────────────
type Type = 'primary' | 'secondary' | 'tertiary' | 'error';
type State = 'default' | 'hover' | 'focus' | 'disabled' | 'loading';

const BUTTON_SIZE = {
  sm: { h: 32, padX: 12, gap: 6, radius: 6, font: { size: 14, lh: 20 } },
  md: { h: 40, padX: 16, gap: 6, radius: 6, font: { size: 14, lh: 20 } },
  lg: { h: 48, padX: 20, gap: 8, radius: 8, font: { size: 16, lh: 20 } },
} as const;

/** [fill, stroke, text] token names per Figma variant; null = none. */
function buttonColors(type: Type, state: State): { fill: string | null; stroke: string | null; text: string } {
  const off = state === 'disabled' || state === 'loading';
  if (off) return type === 'tertiary' ? { fill: null, stroke: null, text: 'text/disabled' } : { fill: 'action/disabled', stroke: 'border/default', text: 'text/disabled' };
  const hover = state === 'hover';
  switch (type) {
    case 'primary':
      return { fill: hover ? 'action/primary-hover' : 'action/primary', stroke: null, text: 'text/inverse' };
    case 'secondary':
      return { fill: hover ? 'action/secondary-hover' : 'action/secondary', stroke: hover ? 'border/hover' : 'border/default', text: 'text/primary' };
    case 'tertiary':
      return { fill: hover ? 'action/tertiary-hover' : null, stroke: null, text: 'text/primary' };
    case 'error':
      return { fill: hover ? 'action/danger-hover' : 'action/danger', stroke: null, text: 'text/inverse' };
  }
}

async function press(page: Page, state: State, target: ReturnType<Page['locator']>) {
  if (state === 'hover') await target.hover();
  if (state === 'focus') await page.keyboard.press('Tab');
}

test.describe('Button', () => {
  for (const type of ['primary', 'secondary', 'tertiary', 'error'] as Type[]) {
    for (const state of ['default', 'hover', 'focus', 'disabled', 'loading'] as State[]) {
      test(`${type} · small · ${state}`, async ({ page }) => {
        const stage = await open(page, { c: 'button', variant: type, size: 'sm', state });
        const button = stage.getByRole('button');
        await press(page, state, button);
        const s = await style(button, ['height', 'border-top-left-radius', 'background-color', 'border-top-color', 'border-top-width', 'color', 'font-size', 'font-weight', 'line-height', 'padding-left', 'padding-right']);
        const want = buttonColors(type, state);
        const spec = BUTTON_SIZE.sm;

        expect(s.height).toBe(`${spec.h}px`);
        expect(s['border-top-left-radius']).toBe(`${spec.radius}px`);
        expect(s['background-color']).toBe(want.fill ? token(want.fill) : TRANSPARENT);
        if (want.stroke) expect(s['border-top-color']).toBe(token(want.stroke)); // (no stroke = border-width 0, checked below)
        expect(s.color).toBe(token(want.text));
        expect(s['font-size']).toBe(`${spec.font.size}px`);
        expect(s['font-weight']).toBe('500');
        expect(s['line-height']).toBe(`${spec.font.lh}px`);
        // Figma counts the stroke IN the layout: padding is 12 and the 1px stroke exists only where Figma has one.
        expect(s['padding-left']).toBe(`${spec.padX}px`);
        expect(s['padding-right']).toBe(`${spec.padX}px`);
        expect(s['border-top-width']).toBe(want.stroke ? '1px' : '0px');
      });
    }
  }

  for (const size of ['sm', 'md', 'lg'] as const) {
    test(`${size}: height, padding, gap, radius, type scale`, async ({ page }) => {
      const stage = await open(page, { c: 'button', variant: 'primary', size, leading: 'setting-2' });
      const button = stage.getByRole('button');
      const spec = BUTTON_SIZE[size];
      const s = await style(button, ['height', 'border-top-left-radius', 'font-size', 'line-height', 'column-gap', 'padding-left']);
      expect(s.height).toBe(`${spec.h}px`);
      expect(s['border-top-left-radius']).toBe(`${spec.radius}px`);
      expect(s['font-size']).toBe(`${spec.font.size}px`);
      expect(s['line-height']).toBe(`${spec.font.lh}px`);
      expect(s['column-gap']).toBe(`${spec.gap}px`);
      expect(s['padding-left']).toBe(`${spec.padX}px`);
      const icon = await box(button.locator('svg').first());
      expect([icon.width, icon.height]).toEqual([16, 16]); // "16px icons"
    });
  }

  test('widths follow Figma: stroke variants are 2px wider, the spinner adds 22px', async ({ page }) => {
    const width = async (params: Record<string, string>) => (await box((await open(page, { c: 'button', size: 'sm', ...params })).getByRole('button'))).width;
    const primary = await width({ variant: 'primary' });
    near(await width({ variant: 'secondary' }), primary + 2, 1.01); // Figma 68 vs 70 (label widths differ by <1px between Figma and Chrome)
    near(await width({ variant: 'tertiary' }), primary, 1.01);
    near(await width({ variant: 'primary', state: 'disabled' }), primary + 2, 1.01);
    near(await width({ variant: 'primary', state: 'loading' }), primary + 2 + 22, 1.01); // Figma 92 = 68 + stroke 2 + spinner 16 + gap 6
    near(await width({ variant: 'tertiary', state: 'loading' }), primary + 22, 1.01); // Figma 90
  });

  test('loading keeps the label, disables the button and shows the spinner first', async ({ page }) => {
    const stage = await open(page, { c: 'button', variant: 'primary', size: 'sm', state: 'loading' });
    const button = stage.getByRole('button');
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button).toHaveText('Button');
    const spinner = button.locator('svg[data-fyldo-spinner]');
    const spinnerBox = await box(spinner);
    const label = await box(button.locator('span'));
    expect(spinnerBox.x).toBeLessThan(label.x);
    // (a rotating square's bounding box is larger than 16px — read the computed size instead)
    expect(await style(spinner, ['width', 'height'])).toEqual({ width: '16px', height: '16px' });
  });

  test('RTL: content order mirrors (leading icon on the right) and the FA font/line-height apply', async ({ page }) => {
    const stage = await open(page, { c: 'button', variant: 'primary', size: 'sm', leading: 'setting-2', dir: 'rtl' });
    const button = stage.getByRole('button');
    const icon = await box(button.locator('svg').first());
    const label = await box(button.locator('span'));
    expect(icon.x).toBeGreaterThan(label.x);
    const s = await style(button, ['font-family', 'line-height']);
    expect(s['font-family']).toContain('Fyldo Vazirmatn');
    expect(s['line-height']).toBe('22px'); // FA/Button/14
  });
});

// ── Input ──────────────────────────────────────────────────────────────────────────────────────────────
const INPUT_SIZE = { sm: { control: 32, radius: 6, size: 14, lh: 20, total: 86 }, md: { control: 40, radius: 6, size: 14, lh: 20, total: 94 }, lg: { control: 48, radius: 8, size: 16, lh: 24, total: 102 } } as const;

test.describe('Input', () => {
  for (const size of ['sm', 'md', 'lg'] as const) {
    test(`${size}: control height, radius, text style, padding, stack spacing`, async ({ page }) => {
      const stage = await open(page, { c: 'input', size, state: 'default' });
      const spec = INPUT_SIZE[size];
      const wrapper = stage.locator('[data-slot=fy-input]');
      const s = await style(wrapper, ['height', 'border-top-left-radius', 'border-top-width', 'border-top-color', 'background-color', 'column-gap']);
      expect(s.height).toBe(`${spec.control}px`);
      expect(s['border-top-left-radius']).toBe(`${spec.radius}px`);
      expect(s['border-top-width']).toBe('1px');
      expect(s['border-top-color']).toBe(token('border/input')); // Figma: Control frame bound to border/input
      expect(s['background-color']).toBe(token('background/default'));
      expect(s['column-gap']).toBe('8px');

      const input = stage.locator('input');
      const t = await style(input, ['font-size', 'line-height', 'font-weight', 'color']);
      expect(t['font-size']).toBe(`${spec.size}px`);
      expect(t['line-height']).toBe(`${spec.lh}px`);

      const w = await box(wrapper);
      const i = await box(input);
      near(i.x - w.x, 13); // 12 padding + 1 stroke (Figma counts the stroke in the layout: 320 − 26 = 294)
      near(w.width - (i.x - w.x) - i.width, 13);

      const whole = await box(stage.locator('[data-slot=fy-input]').locator('xpath=ancestor::*[contains(@class,"group/field")][1]'));
      near(whole.height, spec.total, 1); // label 20 + 8 + control + 8 + helper 18
    });
  }

  test('label and helper use Label/14 Strong and Copy/13', async ({ page }) => {
    const stage = await open(page, { c: 'input', size: 'sm' });
    const label = await style(stage.locator('label'), ['font-size', 'font-weight', 'line-height', 'color']);
    expect(label).toMatchObject({ 'font-size': '14px', 'font-weight': '500', 'line-height': '20px', color: token('text/primary') });
    const helper = await style(stage.getByText('Shown in the browser tab'), ['font-size', 'font-weight', 'line-height', 'color']);
    expect(helper).toMatchObject({ 'font-size': '13px', 'font-weight': '400', 'line-height': '18px', color: token('text/secondary') });
  });

  test('states: hover, focus, filled, error, disabled', async ({ page }) => {
    const wrapperOf = async (state: string) => (await open(page, { c: 'input', size: 'sm', state })).locator('[data-slot=fy-input]');

    let wrapper = await wrapperOf('default');
    await wrapper.hover();
    expect((await style(wrapper, ['border-top-color']))['border-top-color']).toBe(token('border/input-hover'));

    wrapper = await wrapperOf('filled');
    await expect(page.locator('input')).toHaveValue('Fyldo');

    wrapper = await wrapperOf('error');
    const error = await style(wrapper, ['border-top-color', 'box-shadow']);
    expect(error['border-top-color']).toBe(token('status/error/solid'));
    expect(shadows(error['box-shadow'] as string)).toEqual([shadow('#da2f3529', 0, 0, 0, 3)]); // Focus/Input Error: 3px rgba(218,47,53,.16)
    const message = page.getByText('This title is already in use.');
    expect((await style(message, ['color', 'font-size']))).toEqual({ color: token('status/error/text'), 'font-size': '13px' });
    await expect(page.getByText('Shown in the browser tab')).toHaveCount(0); // the error REPLACES the helper
    await expect(page.locator('input')).toHaveAttribute('aria-invalid', 'true');

    wrapper = await wrapperOf('disabled');
    const disabled = await style(wrapper, ['background-color', 'border-top-color']);
    expect(disabled['background-color']).toBe(token('surface/disabled'));
    expect(disabled['border-top-color']).toBe(token('border/default')); // Disabled keeps border/default in Figma
    await wrapper.hover({ force: true });
    expect((await style(wrapper, ['border-top-color']))['border-top-color']).toBe(token('border/default'));
    expect((await style(page.locator('label'), ['color'])).color).toBe(token('text/disabled'));
    await expect(page.locator('input')).toBeDisabled();
  });
});

test('Input focus: the approved neutral border (Figma token focus/border) + the Focus/Input halo', async ({ page }) => {
  const stage = await open(page, { c: 'input', size: 'sm', state: 'default' });
  await page.locator('input').focus();
  const focused = await style(stage.locator('[data-slot=fy-input]'), ['border-top-color', 'box-shadow']);
  // Figma token `focus/border` (decision O5).
  expect(focused['border-top-color']).toBe(token('focus/border'));
  expect(shadows(focused['box-shadow'] as string)).toEqual([shadow('#0000001a', 0, 0, 0, 3)]); // Focus/Input: 3px rgba(0,0,0,.10)
});

// ── Toggle ─────────────────────────────────────────────────────────────────────────────────────────────
const TOGGLE = { sm: { w: 28, h: 16, thumb: 12, travel: 12, label: 13, gap: 8 }, md: { w: 36, h: 20, thumb: 16, travel: 16, label: 14, gap: 12 } } as const;

test.describe('Toggle', () => {
  for (const size of ['sm', 'md'] as const) {
    for (const checked of [false, true]) {
      test(`${size} · ${checked ? 'on' : 'off'}: track, thumb, travel, colours`, async ({ page }) => {
        const stage = await open(page, { c: 'toggle', size, checked: checked ? '1' : '0' });
        const spec = TOGGLE[size];
        const track = stage.getByRole('switch');
        const thumb = track.locator('span').first();
        const t = await box(track);
        const th = await box(thumb);
        expect([t.width, t.height]).toEqual([spec.w, spec.h]);
        expect([th.width, th.height]).toEqual([spec.thumb, spec.thumb]);
        // thumb sits 2px from the start edge when off, 2px from the end when on
        near(th.x - t.x, checked ? spec.w - 2 - spec.thumb : 2);

        const s = await style(track, ['background-color', 'border-top-left-radius']);
        expect(s['background-color']).toBe(token(checked ? 'control/on' : 'control/off'));
        expect(s['border-top-left-radius']).toBe('9999px');
        const ts = await style(thumb, ['background-color', 'box-shadow']);
        expect(ts['background-color']).toBe(token('control/thumb'));
        expect(shadows(ts['box-shadow'] as string)).toEqual([shadow('#00000029', 0, 1, 2, 0), shadow('#00000014', 0, 0, 0, 0.5)]); // Shadow/Thumb
      });
    }

    test(`${size}: label style and gap`, async ({ page }) => {
      const stage = await open(page, { c: 'toggle', size });
      const spec = TOGGLE[size];
      const text = stage.getByText('Enable caching');
      expect((await style(text, ['font-size', 'font-weight']))).toEqual({ 'font-size': `${spec.label}px`, 'font-weight': '400' });
      const t = await box(stage.getByRole('switch'));
      const l = await box(text);
      near(l.x - (t.x + t.width), spec.gap);
    });
  }

  test('states: hover, disabled (off and on)', async ({ page }) => {
    let stage = await open(page, { c: 'toggle', size: 'sm' });
    await stage.getByRole('switch').hover();
    expect((await style(stage.getByRole('switch'), ['background-color']))['background-color']).toBe(token('control/off-hover'));

    stage = await open(page, { c: 'toggle', size: 'sm', checked: '1' });
    await stage.getByRole('switch').hover();
    expect((await style(stage.getByRole('switch'), ['background-color']))['background-color']).toBe(token('control/on-hover'));

    stage = await open(page, { c: 'toggle', size: 'sm', state: 'disabled' });
    const off = await style(stage.getByRole('switch'), ['background-color']);
    expect(off['background-color']).toBe(token('control/off-disabled'));
    expect((await style(stage.locator('span').filter({ hasText: 'Enable caching' }), ['color'])).color).toBe(token('text/disabled'));
    expect(shadows((await style(stage.getByRole('switch').locator('span').first(), ['box-shadow']))['box-shadow'] as string)).toEqual([]); // no thumb shadow when disabled

    stage = await open(page, { c: 'toggle', size: 'sm', checked: '1', state: 'disabled' });
    expect((await style(stage.getByRole('switch'), ['background-color']))['background-color']).toBe(token('control/on-disabled'));
  });

  test('RTL: "on" puts the thumb on the left', async ({ page }) => {
    const stage = await open(page, { c: 'toggle', size: 'sm', checked: '1', dir: 'rtl' });
    const t = await box(stage.getByRole('switch'));
    const th = await box(stage.getByRole('switch').locator('span').first());
    near(th.x - t.x, 2);
  });
});

// ── Select ─────────────────────────────────────────────────────────────────────────────────────────────
test.describe('Select', () => {
  for (const size of ['sm', 'md', 'lg'] as const) {
    test(`${size}: trigger height, radius, chevron, placeholder colour`, async ({ page }) => {
      const stage = await open(page, { c: 'select', size, state: 'default' });
      const spec = INPUT_SIZE[size];
      const trigger = stage.getByRole('combobox');
      const s = await style(trigger, ['height', 'border-top-left-radius', 'border-top-color', 'background-color', 'font-size', 'line-height']);
      expect(s.height).toBe(`${spec.control}px`);
      expect(s['border-top-left-radius']).toBe(`${spec.radius}px`);
      expect(s['border-top-color']).toBe(token('border/input'));
      expect(s['font-size']).toBe(`${spec.size}px`);
      expect(s['line-height']).toBe(`${spec.lh}px`);

      const value = stage.getByText('Select a role…');
      expect((await style(value, ['color'])).color).toBe(token('text/tertiary'));

      const chevron = await box(trigger.locator('svg[data-fyldo-icon="arrowdown2"]'));
      const t = await box(trigger);
      expect([chevron.width, chevron.height]).toEqual([16, 16]);
      near(t.x + t.width - (chevron.x + chevron.width), 13); // 12 padding + 1 stroke
    });
  }

  test('filled, error and disabled', async ({ page }) => {
    let stage = await open(page, { c: 'select', size: 'sm', state: 'filled' });
    expect((await style(stage.getByText('Subscriber').first(), ['color'])).color).toBe(token('text/primary'));

    stage = await open(page, { c: 'select', size: 'sm', state: 'error' });
    const error = await style(stage.getByRole('combobox'), ['border-top-color', 'box-shadow']);
    expect(error['border-top-color']).toBe(token('status/error/solid'));
    expect(shadows(error['box-shadow'] as string)).toEqual([shadow('#da2f3529', 0, 0, 0, 3)]);

    stage = await open(page, { c: 'select', size: 'sm', state: 'disabled' });
    const off = await style(stage.getByRole('combobox'), ['background-color', 'border-top-color']);
    expect(off['background-color']).toBe(token('surface/disabled'));
    expect(off['border-top-color']).toBe(token('border/default'));
  });

  test('open: focus look, arrow-up, menu as wide as the field 4px below, check at the END of the selected row', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    const stage = await open(page, { c: 'select', size: 'sm', state: 'filled' });
    const trigger = stage.getByRole('combobox');
    await trigger.click();

    const open$ = await style(trigger, ['border-top-color', 'box-shadow']);
    expect(shadows(open$['box-shadow'] as string)).toEqual([shadow('#0000001a', 0, 0, 0, 3)]); // open = the focus look
    expect(open$['border-top-color']).toBe(token('focus/border')); // Open uses focus/border
    await expect(trigger.locator('svg[data-fyldo-icon="arrowup2"]')).toBeVisible();

    const menu = page.locator('[data-slot=fy-select-menu]');
    const m = await box(menu);
    const t = await box(trigger);
    near(m.width, t.width);
    near(m.y - (t.y + t.height), 4);
    const ms = await style(menu, ['border-top-left-radius', 'padding-top', 'box-shadow', 'background-color']);
    expect(ms['border-top-left-radius']).toBe('12px');
    expect(shadows(ms['box-shadow'] as string)).toEqual([shadow('#0000000a', 0, 4, 8, -4), shadow('#0000000f', 0, 16, 24, -8)]); // Shadow/Medium
    expect(ms['padding-top']).toBe('4px');
    expect(ms['background-color']).toBe(token('background/default'));

    const item = page.getByRole('option', { name: 'Subscriber' });
    const i = await box(item);
    expect(i.height).toBe(36);
    const check = await box(item.locator('svg[data-fyldo-icon="tickcircle"]'));
    expect(check.x + check.width).toBeGreaterThan(i.x + i.width - 12); // at the end
    expect((await style(page.getByRole('option', { name: 'Editor' }), ['border-top-left-radius']))['border-top-left-radius']).toBe('6px');

    await page.getByRole('option', { name: 'Editor' }).hover();
    expect((await style(page.getByRole('option', { name: 'Editor' }), ['background-color']))['background-color']).toBe(token('surface/default'));
  });
});
