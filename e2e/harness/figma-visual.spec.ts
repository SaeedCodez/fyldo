/**
 * Pixel comparison against Figma reference PNGs (tests/visual/figma/*.png, exported through the figma-console MCP).
 *
 * Anti-aliasing and font hinting differ between Figma and Chrome, and a Figma export is a tight box around the component,
 * so this is a coarse guard (few differing pixels, generous colour threshold) — the exact numbers live in
 * figma-parity.spec.ts. To refresh a reference: figma_take_screenshot(nodeId, scale) and copy the PNG here.
 * Failures write actual/diff images next to the test results for visual review.
 */
import { expect, test } from '@playwright/test';
import { open } from './support/figma';

test.use({ reducedMotion: 'reduce' });

const CASES: Array<{ name: string; scale: number; params: Record<string, string>; bleed?: number }> = [
  { name: 'input-default', scale: 3, params: { c: 'input', size: 'sm', state: 'default' } },
  { name: 'input-error', scale: 3, params: { c: 'input', size: 'sm', state: 'error' }, bleed: 3 }, // Figma's export is 326px wide: the 3px halo on each side
  { name: 'button-secondary', scale: 4, params: { c: 'button', variant: 'secondary', size: 'sm' } },
  { name: 'button-loading', scale: 4, params: { c: 'button', variant: 'primary', size: 'sm', state: 'loading' } },
  { name: 'toggle-on', scale: 4, params: { c: 'toggle', size: 'sm', checked: '1' } },
  { name: 'toggle-off', scale: 4, params: { c: 'toggle', size: 'sm', checked: '0' } }, // track = control/off (gray/700 after the O4 fix)
  { name: 'select-default', scale: 3, params: { c: 'select', size: 'sm', state: 'default' } },
];

for (const c of CASES) {
  test(`matches the Figma export: ${c.name}`, async ({ browser }) => {
    const context = await browser.newContext({ deviceScaleFactor: c.scale, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const stage = await open(page, c.params);
    // The spinner rotates; freeze it at its authored angle.
    await page.addStyleTag({ content: '[data-fyldo-spinner]{animation:none !important}' });
    const b = (await stage.boundingBox()) as { x: number; y: number; width: number; height: number };
    const bleed = c.bleed ?? 0;
    // Figma exports the component's own bounds (halo included); ours is clipped the same way, device pixels.
    await expect(page).toHaveScreenshot(`${c.name}.png`, {
      clip: { x: b.x - bleed, y: b.y, width: b.width + bleed * 2, height: b.height }, // Figma's export bleeds sideways only
      scale: 'device',
      maxDiffPixelRatio: 0.08,
      threshold: 0.3,
    });
    await context.close();
  });
}
