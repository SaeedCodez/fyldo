/**
 * M5-lite — under `prefers-reduced-motion: reduce` every animation and transition is off (the spinner included), and
 * with no preference the spinner does turn (so the test would notice the rule going missing).
 */
import { expect, test, type Page } from '@playwright/test';

const PAGES = [
  '/e2e/.generated/gallery/index.html?c=button&variant=primary&size=md&state=loading',
  '/e2e/.generated/gallery/index.html?c=toast&tone=loading&title=Saving',
  '/e2e/.generated/gallery/index.html?c=modal&type=danger&title=Reset%20all%20settings%3F&cancel=Cancel&confirm=Reset&keyword=RESET',
  '/e2e/.generated/gallery/index.html?c=save-bar&state=saving',
  '/tests/harness/#/general',
];

/** Elements (and their ::before/::after) of the Fyldo root that animate or transition. */
const motion = (page: Page) =>
  page.evaluate(() => {
    const found: string[] = [];
    for (const el of document.querySelectorAll('[data-fyldo-v1], [data-fyldo-v1] *')) {
      for (const pseudo of [null, '::before', '::after']) {
        const style = getComputedStyle(el, pseudo);
        if (style.animationName !== 'none') found.push(`${el.tagName}${pseudo ?? ''} animation ${style.animationName}`);
        if (style.transitionDuration.split(',').some((d) => parseFloat(d) > 0)) found.push(`${el.tagName}${pseudo ?? ''} transition ${style.transitionDuration}`);
      }
    }
    return { found, running: document.getAnimations().length };
  });

test.describe('reduce', () => {
  test.use({ reducedMotion: 'reduce' });
  for (const url of PAGES) {
    test(`no animation or transition · ${url.split('?')[1] ?? url}`, async ({ page }) => {
      await page.goto(url);
      await page.locator('[data-fyldo-v1] *').first().waitFor();
      await page.waitForTimeout(300);
      expect(await motion(page)).toEqual({ found: [], running: 0 });
    });
  }
});

test('with no preference the spinner turns', async ({ page }) => {
  await page.goto(PAGES[0]!);
  await page.locator('[data-fyldo-spinner]').waitFor();
  expect((await motion(page)).found.some((f) => f.includes('animation fyldo-spin'))).toBe(true);
});
