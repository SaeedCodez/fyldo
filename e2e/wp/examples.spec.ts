/**
 * The example plugins (examples/, docs/ARCHITECTURE.md §12, M8): one small plugin per way of installing Fyldo, each
 * built from the CURRENT tree by tools/fixtures/make-demos.ts, so they cannot rot. The same screen in all four (a text
 * field, a toggle, a select); only the loading differs:
 *   dropin    fyldo/ inside the plugin           composer  vendor/ from `composer install`
 *   strauss   vendor-prefixed/, Acme\Vendor\     requires  no copy: `Requires Plugins: fyldo` and the plugin `fyldo`
 * Each one runs alone: the probe shows the one copy it loads at the current version, from its own folder; a save through
 * the Save Bar survives a reload.
 *
 * The highest copy wins site-wide, so the shared demos (Fyldo 1.0.0 / 1.1.0 / 2.0.0 fixtures) are deactivated for this
 * spec and restored after it, as upgrade.spec.ts does (which relies on them being active again). The examples and the
 * plugin `fyldo` are mapped by .wp-env.json, never activated there, and left inactive here; their options are deleted.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { probe, settingsUrl, wp, wpJson } from './helpers';

const SHARED_DEMOS = ['acme-alpha', 'acme-beta', 'acme-gamma', 'acme-delta', 'acme-omega'];
const VERSION = /^ \* Version:\s+(\S+)$/m.exec(readFileSync('fyldo.php', 'utf8'))?.[1];

const EXAMPLES = [
  { mode: 'dropin', namespace: 'Fyldo\\V1', path: /\/acme-example-dropin\/fyldo$/ },
  {
    mode: 'composer',
    namespace: 'Fyldo\\V1',
    path: /\/acme-example-composer\/vendor\/fyldo\/fyldo$/,
  },
  {
    mode: 'strauss',
    namespace: 'Acme\\Vendor\\Fyldo\\V1',
    path: /\/acme-example-strauss\/vendor-prefixed\//,
  },
  { mode: 'requires', namespace: 'Fyldo\\V1', path: /\/plugins\/fyldo$/ },
].map((example) => ({ ...example, slug: `acme-example-${example.mode}` }));
const EXAMPLE_SLUGS = EXAMPLES.map((example) => example.slug);

let initiallyActive: string[] = [];

const activePlugins = (): string[] =>
  wpJson<Array<{ name: string }>>('plugin', 'list', '--status=active', '--fields=name').map(
    (plugin) => plugin.name,
  );

/** Deactivates the active ones among `names`, in the order given (an example before the plugin it requires). */
function deactivate(...names: string[]): void {
  const active = activePlugins();
  const todo = names.filter((name) => active.includes(name));
  if (todo.length > 0) wp('plugin', 'deactivate', ...todo);
}

/** Every option the examples saved (`acme-example-*_general` and `__fyldo`), only the ones that exist. */
function deleteExampleOptions(): void {
  const names = wpJson<Array<{ option_name: string }>>(
    'option',
    'list',
    '--search=acme-example-*',
    '--fields=option_name',
  ).map((option) => option.option_name);
  if (names.length > 0) wp('option', 'delete', ...names);
}

test.describe('example plugins', () => {
  test.beforeAll(() => {
    test.setTimeout(120_000);
    initiallyActive = activePlugins();
    deactivate(...EXAMPLE_SLUGS, 'fyldo', ...SHARED_DEMOS);
    deleteExampleOptions();
  });

  test.afterEach(() => {
    test.setTimeout(120_000);
    deactivate(...EXAMPLE_SLUGS, 'fyldo');
    deleteExampleOptions();
  });

  test.afterAll(() => {
    test.setTimeout(120_000);
    deactivate(...EXAMPLE_SLUGS, 'fyldo');
    deleteExampleOptions();
    const restore = SHARED_DEMOS.filter((name) => initiallyActive.includes(name));
    if (restore.length > 0) wp('plugin', 'activate', ...restore);
  });

  for (const example of EXAMPLES) {
    test(`${example.mode}: the only Fyldo copy is its own, and a save survives a reload`, async ({
      page,
      request,
    }) => {
      test.setTimeout(180_000);
      expect(VERSION).toBeTruthy();

      await test.step('activate it alone', () => {
        if (example.mode === 'requires') wp('plugin', 'activate', 'fyldo');
        wp('plugin', 'activate', example.slug);
        expect(activePlugins()).toContain(example.slug);
      });

      await test.step('the probe shows one Fyldo copy, at the current version, from its folder', async () => {
        const state = await probe(request);
        expect(Object.keys(state)).toEqual([example.namespace]);
        const copy = state[example.namespace]!;
        expect(copy.version).toBe(VERSION);
        expect(copy.copies).toHaveLength(1);
        expect(copy.path).toMatch(example.path);
      });

      await test.step('its screen shows the defaults', async () => {
        await page.goto(settingsUrl(example.slug));
        await expect(page.getByRole('textbox', { name: 'Site title' })).toHaveValue('My site');
        await expect(page.getByRole('switch', { name: 'Enabled' })).toHaveAttribute(
          'aria-checked',
          'true',
        );
        await expect(page.getByRole('combobox', { name: 'Layout' })).toContainText('Grid');
      });

      await test.step('change the text field and save with the Save Bar', async () => {
        await page.getByRole('textbox', { name: 'Site title' }).fill(`Saved by ${example.mode}`);
        await page.getByRole('button', { name: 'Save changes' }).click();
        await expect(page.getByText('All changes saved')).toBeVisible();
      });

      await test.step('after a reload the value is still there', async () => {
        await page.reload();
        await expect(page.getByRole('textbox', { name: 'Site title' })).toHaveValue(
          `Saved by ${example.mode}`,
        );
        expect(wpJson(`option`, 'get', `${example.slug}_general`)).toMatchObject({
          site_title: `Saved by ${example.mode}`,
        });
      });
    });
  }

  test('requires: WordPress activates it only while the fyldo plugin is active', () => {
    test.setTimeout(120_000);
    const slug = 'acme-example-requires';

    // `Requires Plugins: fyldo` is checked against the active plugins; the folder name `fyldo` is the slug it resolves.
    expect(activePlugins()).not.toContain('fyldo');
    try {
      wp('plugin', 'activate', slug);
    } catch {
      // WP-CLI reports the refusal as an error; the state below is what counts.
    }
    expect(activePlugins()).not.toContain(slug);

    wp('plugin', 'activate', 'fyldo');
    wp('plugin', 'activate', slug);
    expect(activePlugins()).toContain(slug);
  });
});
