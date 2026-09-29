import { expect, test, type Page } from '@playwright/test';
import { settingsUrl, resetData } from './helpers';

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

const NORMAL = settingsUrl('acme-beta');
const HOSTILE = settingsUrl('acme-beta', '&fyldo_hostile=1');

/** Computed-style fingerprint of every kind of Fyldo control, taken inside the page. */
async function fingerprint(page: Page): Promise<Record<string, Record<string, string>>> {
  return page.evaluate(() => {
    const pick = (el: Element | null, props: string[]): Record<string, string> => {
      if (!el) return { missing: 'true' };
      const cs = getComputedStyle(el);
      return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
    };
    const root = document.querySelector('[data-fyldo-v1]')!;
    const box = ['height', 'width', 'border-top-width', 'border-top-style', 'border-top-color', 'border-radius', 'background-color', 'padding-left', 'padding-top', 'box-shadow', 'outline-style', 'margin-top', 'margin-bottom'];
    const text = ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform', 'color', 'text-align'];
    return {
      root: pick(root, [...box, ...text]),
      h1: pick(root.querySelector('h1'), [...box, ...text]),
      h2: pick(root.querySelector('h2'), [...box, ...text]),
      description: pick(root.querySelector('p'), [...box, ...text]),
      label: pick(root.querySelector('label'), [...box, ...text]),
      card: pick(root.querySelector('[data-slot=fy-section-card]'), box),
      inputBox: pick(root.querySelector('[data-slot=fy-input]'), [...box, ...text]),
      inputInner: pick(root.querySelector('[data-slot=fy-input] input'), [...box, ...text]),
      selectTrigger: pick(root.querySelector('[data-slot=fy-select]'), [...box, ...text]),
      toggle: pick(root.querySelector('[data-slot=fy-toggle]'), box),
      icon: pick(root.querySelector('svg[data-fyldo-icon]'), ['width', 'height', 'stroke', 'fill']),
    };
  });
}

test('static guarantee: every stylesheet rule is scoped to the Fyldo root, and nothing is layered', async ({ page }) => {
  await page.goto(NORMAL);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const offenders = await page.evaluate(() => {
    const sheet = [...document.styleSheets].find((s) => s.href?.includes('/assets/dist/app.css'));
    if (!sheet) return ['<app.css not found>'];
    const bad: string[] = [];
    const topLevel = (selector: string) => {
      const parts: string[] = [];
      let depth = 0;
      let current = '';
      for (const ch of selector) {
        if (ch === '(' || ch === '[') depth++;
        if (ch === ')' || ch === ']') depth--;
        if (ch === ',' && depth === 0) {
          parts.push(current.trim());
          current = '';
        } else current += ch;
      }
      return [...parts, current.trim()];
    };
    const walk = (rules: CSSRuleList) => {
      for (const rule of rules) {
        const type = rule.constructor.name;
        if (type === 'CSSStyleRule') {
          for (const part of topLevel((rule as CSSStyleRule).selectorText)) {
            if (!/^\[data-fyldo-v\d\]\[data-fyldo-v\d\](:not\(#\\#\))?/.test(part) && !/^body\.fyldo-screen/.test(part)) bad.push(part);
          }
        } else if (type === 'CSSMediaRule' || type === 'CSSSupportsRule') walk((rule as CSSMediaRule).cssRules);
        else if (type.startsWith('CSSLayer')) bad.push(`@layer (${type})`);
      }
    };
    walk(sheet.cssRules);
    return bad;
  });

  expect(offenders).toEqual([]);
});

test('hostile admin CSS changes NOTHING about Fyldo’s computed styles', async ({ page }) => {
  await page.goto(NORMAL);
  await expect(page.getByRole('textbox', { name: 'Site title' })).toBeVisible();
  const normal = await fingerprint(page);

  await page.goto(HOSTILE);
  await expect(page.locator('#fyldo-hostile')).toBeAttached(); // the hostile stylesheet really is on the page
  await expect(page.getByRole('textbox', { name: 'Site title' })).toBeVisible();
  const hostile = await fingerprint(page);

  expect(hostile).toEqual(normal);

  // …and the values are the Figma ones, not just "unchanged".
  expect(normal.inputBox).toMatchObject({ height: '32px', 'border-top-width': '1px', 'border-radius': '6px', 'background-color': 'rgb(255, 255, 255)', 'font-size': '14px' });
  expect(normal.selectTrigger).toMatchObject({ height: '32px', 'border-radius': '6px' });
  expect(normal.h1).toMatchObject({ 'font-size': '32px', 'font-weight': '600', 'margin-top': '0px' });
});

test('wp-admin’s blue focus never shows: every control, keyboard-focused, on hostile AND normal pages', async ({ page }) => {
  for (const url of [NORMAL, HOSTILE]) {
    await page.goto(url);
    await expect(page.getByRole('textbox', { name: 'Site title' })).toBeVisible();

    const blue: string[] = [];
    await page.getByRole('textbox', { name: 'Site title' }).focus();

    for (let i = 0; i < 6; i++) {
      const found = await page.evaluate(() => {
        const root = document.querySelector('[data-fyldo-v1]')!;
        const hits: string[] = [];
        for (const el of [document.activeElement, ...root.querySelectorAll('*')]) {
          if (!el) continue;
          const cs = getComputedStyle(el);
          for (const value of [cs.boxShadow, cs.outlineColor, cs.borderTopColor, cs.borderBottomColor]) {
            if (/34, 113, 177|79, 148, 212|0, 107, 245|0, 114, 245/.test(value)) hits.push(`${(el as HTMLElement).tagName}.${(el as HTMLElement).dataset.slot ?? ''}: ${value}`);
          }
        }
        return hits;
      });
      blue.push(...found);
      await page.keyboard.press('Tab');
    }
    expect(blue, url).toEqual([]);
  }
});

test('keyboard focus is visible and neutral on every control', async ({ page }) => {
  await page.goto(NORMAL);
  const title = page.getByRole('textbox', { name: 'Site title' });
  await title.focus();
  const wrapper = page.locator('[data-slot=fy-input]').first();
  const halo = await wrapper.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(halo).toContain('0px 0px 0px 3px'); // Figma "Focus/Input" halo

  await page.locator('[data-slot=fy-toggle]').first().focus();
  await page.keyboard.press('Tab'); // move away and back with the keyboard so :focus-visible applies
  await page.keyboard.press('Shift+Tab');
  const ring = await page.locator('[data-slot=fy-toggle]').first().evaluate((el) => getComputedStyle(el).boxShadow);
  expect(ring).toMatch(/rgb\(255, 255, 255\) 0px 0px 0px 2px/); // 2px white gap …
  expect(ring).toMatch(/rgb\(23, 23, 23\) 0px 0px 0px 4px/); // … + 2px gray/1000 ring
});

test('popups render INSIDE the Fyldo root and keep their styles', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 }); // room for the 310px menu below the field
  await page.goto(HOSTILE);
  const field = page.getByRole('combobox', { name: 'Site language' });
  await field.click();

  const menu = page.locator('[data-fyldo-v1] [data-slot=fy-select-menu]');
  await expect(menu).toBeVisible();
  await expect(page.locator('body > [data-slot=fy-select-menu]')).toHaveCount(0); // never portalled to <body>

  const style = await menu.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { radius: cs.borderTopLeftRadius, bg: cs.backgroundColor, border: cs.borderTopWidth };
  });
  expect(style).toEqual({ radius: '12px', bg: 'rgb(255, 255, 255)', border: '1px' });

  const trigger = await field.boundingBox();
  const popup = await menu.boundingBox();
  expect(Math.round(popup!.width)).toBe(Math.round(trigger!.width)); // exactly as wide as the field
  const below = popup!.y > trigger!.y;
  const gap = below ? popup!.y - (trigger!.y + trigger!.height) : trigger!.y - (popup!.y + popup!.height);
  expect(Math.round(gap)).toBe(4); // 4px from the field, never overlaying it
  expect(below).toBe(true);

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
});

test('KNOWN LIMIT: third-party !important still wins in light DOM (documented; Shadow DOM mode would fix it)', async ({ page }) => {
  await page.goto(settingsUrl('acme-beta', '&fyldo_hostile=important'));
  const margin = await page.locator('[data-fyldo-v1] h1').evaluate((el) => getComputedStyle(el).marginTop);
  expect(margin).toBe('40px');
});

test('Fyldo leaves no window global behind, and the page has no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(NORMAL);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const keys = await page.evaluate(() => Object.getOwnPropertyNames(window).filter((k) => /fyldo/i.test(k)));
  expect(keys).toEqual([]); // the config variable was read and deleted
  expect(errors).toEqual([]);
});
