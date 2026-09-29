import { expect, test } from '@playwright/test';
import { DEMOS, probe, settingsUrl, resetData } from './helpers';

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

/**
 * Five plugins are active at once (see tools/fixtures/make-demos.ts):
 *   alpha 1.0.0 · beta 1.1.0 · gamma 1.1.0 (twin) · delta 2.0.0 (synthetic major) · omega 1.1.0 (Strauss-prefixed)
 */
test.describe('PHP negotiation', () => {
  test('the highest 1.x copy wins, ties break deterministically, and only ONE copy is loaded', async ({ request }) => {
    const state = await probe(request);
    const v1 = state['Fyldo\\V1'];
    expect(v1, 'Fyldo\\V1 loader must exist').toBeDefined();

    expect(v1!.version).toBe('1.1.0');
    expect(v1!.path).toMatch(/acme-beta\/fyldo$/); // beta < gamma lexicographically: same version, deterministic winner
    expect(v1!.copies.map((c) => c.version).sort()).toEqual(['1.0.0', '1.1.0', '1.1.0']);

    // Exactly one copy's classes are in memory.
    expect(v1!.included).toHaveLength(1);
    expect(v1!.included[0]).toMatch(/acme-beta\/fyldo\/src\/Fyldo\.php$/);
  });

  test('a different major coexists with its own loader and registry', async ({ request }) => {
    const v2 = (await probe(request))['Fyldo\\V2'];
    expect(v2).toBeDefined();
    expect(v2!.version).toBe('2.0.0');
    expect(v2!.path).toMatch(/acme-delta\/fyldo$/);
    expect(v2!.copies).toHaveLength(1);
  });

  test('a Strauss-prefixed copy is private: own namespace, own winner, no negotiation with the others', async ({ request }) => {
    const omega = (await probe(request))['Omega\\Vendor\\Fyldo\\V1'];
    expect(omega).toBeDefined();
    expect(omega!.version).toBe('1.1.0');
    expect(omega!.path).toMatch(/acme-omega\/vendor-prefixed\/fyldo\/fyldo$/);
    expect(omega!.copies).toHaveLength(1);
  });
});

test.describe('every instance works, independently', () => {
  for (const demo of DEMOS) {
    test(`${demo.slug}: renders, saves through ITS OWN REST namespace, keeps its own data`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));

      await page.goto(settingsUrl(demo.slug));
      const root = page.locator(`[${demo.attribute}="${demo.slug}"]`);
      await expect(root).toBeVisible();
      await expect(root.getByRole('heading', { level: 1, name: 'General' })).toBeVisible();
      await expect(root).toHaveAttribute('id', `fyldo-${demo.slug}-root`);

      const title = root.getByRole('textbox', { name: 'Site title' });
      await title.fill(`Title of ${demo.slug}`);

      const request = page.waitForRequest((r) => r.method() === 'POST' && r.url().includes(demo.restNamespace));
      await root.getByRole('button', { name: 'Save changes' }).click();
      await request;
      await expect(root.getByText('All changes saved')).toBeVisible();

      await page.reload();
      await expect(page.locator(`[${demo.attribute}="${demo.slug}"]`).getByRole('textbox', { name: 'Site title' })).toHaveValue(`Title of ${demo.slug}`);
      expect(errors).toEqual([]);
    });
  }

  test('saving one instance never touches another instance’s data', async ({ page }) => {
    for (const [slug, title] of [['acme-alpha', 'Only alpha'], ['acme-delta', 'Only delta']] as const) {
      await page.goto(settingsUrl(slug));
      await page.getByRole('textbox', { name: 'Site title' }).fill(title);
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByText('All changes saved')).toBeVisible();
    }

    // A third instance, even one running the same winning code as alpha, still has its own default.
    await page.goto(settingsUrl('acme-gamma'));
    await expect(page.getByRole('textbox', { name: 'Site title' })).toHaveValue('Fyldo');
    await page.goto(settingsUrl('acme-alpha'));
    await expect(page.getByRole('textbox', { name: 'Site title' })).toHaveValue('Only alpha');
  });
});

test.describe('assets', () => {
  test('a page served by an OLDER bundled copy loads the WINNER’s assets (handles carry slug + version)', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (r) => requested.push(r.url()));

    await page.goto(settingsUrl('acme-alpha'));
    await expect(page.getByRole('heading', { level: 1, name: 'General' })).toBeVisible();

    expect(requested.some((u) => /\/acme-beta\/fyldo\/assets\/dist\/boot\.js/.test(u))).toBe(true);
    expect(requested.some((u) => /\/acme-alpha\/fyldo\/assets\/dist\/boot\.js/.test(u))).toBe(false);

    const html = await page.content();
    expect(html).toContain('id="fyldo-acme-alpha-1.1.0-js"'); // script handle = fyldo-{slug}-{winner version}
    expect(html).toContain('id="fyldo-acme-alpha-1.1.0-css"');
  });

  test('Fyldo assets load ONLY on the instance’s own screen', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (r) => requested.push(r.url()));

    await page.goto('/wp-admin/options-reading.php');
    await expect(page.locator('#wpadminbar')).toBeVisible();
    await page.goto('/wp-admin/index.php');
    await expect(page.locator('#wpadminbar')).toBeVisible();

    expect(requested.filter((u) => /fyldo/i.test(u) && /assets\/dist/.test(u))).toEqual([]);
  });
});
