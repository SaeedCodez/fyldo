/**
 * M5-lite — the Top Navigation at ≤782px scrolls sideways and fades out at an edge that has more to show (LTR + RTL),
 * and does neither on a wide screen.
 */
import { expect, test, type Page } from '@playwright/test';

const nav = (page: Page) => page.locator('[data-slot=fy-top-nav-nav]');

for (const rtl of [false, true]) {
  test(`top nav scrolls sideways with an edge fade at 375px · ${rtl ? 'FA' : 'EN'}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(`/tests/harness/?nav=top${rtl ? '&dir=rtl' : ''}`);
    const el = nav(page);
    await el.waitFor();

    expect(await el.evaluate((n) => n.scrollWidth > n.clientWidth)).toBe(true);
    expect(await el.evaluate((n) => getComputedStyle(n).overflowX)).toBe('auto');
    const mask = () => el.evaluate((n) => getComputedStyle(n).maskImage);
    expect(await mask()).toContain(rtl ? 'to left' : 'to right');

    // at the start only the end edge fades
    await expect(el).toHaveAttribute('data-fade-end', '');
    await expect(el).not.toHaveAttribute('data-fade-start', '');

    // scrolled to the end: the start edge fades, the end edge does not (scrollLeft counts down in RTL)
    await el.evaluate((n, isRtl) => n.scrollTo({ left: isRtl ? -n.scrollWidth : n.scrollWidth, behavior: 'instant' }), rtl);
    await expect(el).toHaveAttribute('data-fade-start', '');
    await expect(el).not.toHaveAttribute('data-fade-end', '');
  });
}

test('on a wide screen the top nav does not fade', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/tests/harness/?nav=top');
  const el = nav(page);
  await el.waitFor();
  expect(await el.evaluate((n) => getComputedStyle(n).maskImage)).toBe('none');
});
