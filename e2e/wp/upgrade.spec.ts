/**
 * Upgrade N-1 → N on a real WordPress (docs/ARCHITECTURE.md §12, M7): the fixture plugin `acme-upgrade`
 * (tools/fixtures/make-demos.ts) bundles the newest released 1.x tag lower than fyldo.php and the current tree; the
 * option `acme_upgrade_copy` picks the copy it loads and the plugin release it plays:
 *   old  plugin 1.0.0 on Fyldo N-1 (the tag's own code, assets and REST);
 *   new  plugin 1.1.0 on the current Fyldo, the `layout` default changed grid → list with `default_before`.
 * Values saved on old must read back unchanged on new, the unsaved field must keep its old default, the page version
 * must move to 1.1.0 with exactly one `upgraded` call, and a save must work on new.
 *
 * The highest copy wins site-wide, so the shared demos (Fyldo 1.0.0 / 1.1.0 / 2.0.0 fixtures) are deactivated for this
 * spec and restored after it; acme-upgrade is mapped by .wp-env.json but only active here. WP-CLI runs in wp-env's cli
 * container, on the same database.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { probe, readConfig, settingsUrl, wp, wpJson } from './helpers';

const SLUG = 'acme-upgrade';
const NS = 'fyldo-acme-upgrade/v1';
const SHARED_DEMOS = ['acme-alpha', 'acme-beta', 'acme-gamma', 'acme-delta', 'acme-omega'];
const fixture = JSON.parse(readFileSync('e2e/.generated/upgrade.json', 'utf8')) as {
  tag: string;
  from: string;
  to: string;
};

/** What a site saved on the old release; `layout` is left unset on purpose. */
const SAVED = {
  headline: 'Saved on 1.0',
  count: 42,
  enabled: true,
  launch: '2026-11-05',
  buttons: [{ label: 'Docs' }, { label: 'Shop' }],
};

async function screenConfig(
  page: Page,
): Promise<{
  wpNonce: string;
  instanceNonce: string;
  revision: string;
  values: Record<string, unknown>;
}> {
  await page.goto(settingsUrl(SLUG));
  const config = await readConfig(page, SLUG);
  const settings = config.pages.find((p: { id: string }) => p.id === 'settings');
  return {
    wpNonce: config.rest.nonce,
    instanceNonce: config.rest.instanceNonce,
    revision: settings.revision,
    values: settings.values,
  };
}

test.describe('upgrade N-1 → N', () => {
  test.beforeAll(() => {
    test.setTimeout(120_000);
    wp('plugin', 'deactivate', ...SHARED_DEMOS);
    wp('plugin', 'activate', SLUG);
    // A site that installed the old release: no stored values, no recorded version, nothing logged.
    wp('option', 'update', 'acme_upgrade_copy', 'old');
    wp('option', 'delete', 'acme-upgrade_settings', 'acme-upgrade__fyldo');
    wp('option', 'update', 'acme_upgrade_log', '[]', '--format=json');
  });

  test.afterAll(() => {
    test.setTimeout(120_000);
    wp('option', 'update', 'acme_upgrade_copy', 'old');
    wp('plugin', 'deactivate', SLUG);
    wp('plugin', 'activate', ...SHARED_DEMOS);
  });

  test(`values saved on ${fixture.tag} survive the update to the current tree`, async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);

    await test.step(`old: Fyldo ${fixture.from} from ${fixture.tag} is the only copy and runs the page`, async () => {
      const state = (await probe(request))['Fyldo\\V1'];
      expect(state!.version).toBe(fixture.from);
      expect(state!.path).toMatch(/\/acme-upgrade\/fyldo-old$/);
      expect(state!.copies).toHaveLength(1);
    });

    await test.step('old: save every field but layout through REST', async () => {
      const { wpNonce, instanceNonce, revision, values } = await screenConfig(page);
      expect(values.layout).toBe('grid');

      const response = await request.post(`/index.php?rest_route=/${NS}/pages/settings`, {
        headers: {
          'X-HTTP-Method-Override': 'PATCH',
          'X-WP-Nonce': wpNonce,
          'X-Fyldo-Nonce': instanceNonce,
        },
        data: { values: SAVED, revision },
      });
      expect(response.status()).toBe(200);
      expect((await response.json()).values).toEqual({ ...SAVED, layout: 'grid' });

      // Stored: exactly what was saved (layout is read from its default, never written).
      expect(wpJson('option', 'get', 'acme-upgrade_settings')).toEqual(SAVED);
      expect(wpJson('option', 'get', 'acme-upgrade__fyldo')).toEqual({
        pages: { settings: '1.0.0' },
      });
      expect(wpJson('option', 'get', 'acme_upgrade_log')).toEqual([]);
    });

    await test.step('switch to new: plugin 1.1.0 on the current Fyldo', async () => {
      wp('option', 'update', 'acme_upgrade_copy', 'new');
      const state = (await probe(request))['Fyldo\\V1'];
      expect(state!.version).toBe(fixture.to);
      expect(state!.path).toMatch(/\/acme-upgrade\/fyldo$/);
      expect(state!.copies).toHaveLength(1);
    });

    await test.step('new: every saved value reads back unchanged, layout keeps its old default', async () => {
      const expected = { ...SAVED, layout: 'grid' };
      const { wpNonce, instanceNonce, values } = await screenConfig(page);
      expect(values).toEqual(expected);

      const read = await request.get(`/index.php?rest_route=/${NS}/pages/settings`, {
        headers: { 'X-WP-Nonce': wpNonce, 'X-Fyldo-Nonce': instanceNonce },
      });
      expect(read.status()).toBe(200);
      expect((await read.json()).values).toEqual(expected);

      await expect(page.getByRole('textbox', { name: 'Headline' })).toHaveValue('Saved on 1.0');
      await expect(page.getByRole('textbox', { name: 'Count' })).toHaveValue('42');
      await expect(page.getByRole('switch', { name: 'Enabled' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await expect(page.getByRole('combobox', { name: 'Layout' })).toContainText('Grid');
      await expect(page.getByRole('button', { name: 'Launch date', exact: true })).toHaveText(
        'Nov 5, 2026',
      );
      await expect(
        page.getByRole('group', { name: 'Buttons' }).locator('[data-slot=fy-group-item-title]'),
      ).toHaveText(['Docs', 'Shop']);

      // default_before wrote the old default for the field nobody saved; the page now runs on 1.1.0, upgraded once.
      expect(wpJson('option', 'get', 'acme-upgrade_settings')).toEqual(expected);
      expect(wpJson('option', 'get', 'acme-upgrade__fyldo')).toEqual({
        pages: { settings: '1.1.0' },
      });
      expect(wpJson('option', 'get', 'acme_upgrade_log')).toEqual([['settings', '1.0.0', '1.1.0']]);
    });

    await test.step('new: a save through the UI works and nothing upgrades again', async () => {
      const headline = page.getByRole('textbox', { name: 'Headline' });
      await headline.fill('Saved on 1.1');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByText('All changes saved')).toBeVisible();

      await page.reload();
      await expect(page.getByRole('textbox', { name: 'Headline' })).toHaveValue('Saved on 1.1');
      await expect(page.getByRole('combobox', { name: 'Layout' })).toContainText('Grid');
      expect(wpJson('option', 'get', 'acme-upgrade_settings')).toEqual({
        ...SAVED,
        headline: 'Saved on 1.1',
        layout: 'grid',
      });
      expect(wpJson('option', 'get', 'acme_upgrade_log')).toEqual([['settings', '1.0.0', '1.1.0']]);
    });
  });
});
