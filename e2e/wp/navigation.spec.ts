/**
 * M3 part 1 on a real WordPress: the shell and navigation. Client-side routes with URL sync
 * (`options-general.php?page=<slug>#/<page>/<tab>`), real hrefs, Back/Forward, deep links; the wp-admin integration of
 * ARCHITECTURE §8.3 (bleed layout, no footer, admin-bar offsets, the ≤782px Menu disclosure); both layouts (acme-beta:
 * sidebar, acme-gamma: top navigation); EN + FA. The demo plugins register pages `general`, `fields` (badge 3) and
 * `advanced` (tabs `cache`, `debug`; tests/fixtures/tabs-page.php; it saves per section) in the groups Settings and
 * Tools. M3 part 2: the per-section save round trip, and the unsaved-changes guard (in-app dialog, Back, beforeunload).
 */
import { expect, test, type Page } from '@playwright/test';
import { resetData, settingsUrl } from './helpers';

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

const SIDEBAR = settingsUrl('acme-beta');
const TOP = settingsUrl('acme-gamma');
const FA = settingsUrl('acme-beta', '&fyldo_locale=fa_IR');

const nav = (page: Page, name = 'Acme Beta') => page.getByRole('navigation', { name });
const h1 = (page: Page) => page.getByRole('heading', { level: 1 });

test.describe('routing', () => {
  test('nav items are real links; a click routes without a reload, adds history, and Back/Forward restore pages and tabs', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(SIDEBAR);
    await expect(h1(page)).toHaveText('General');
    await expect(nav(page).getByRole('link', { name: 'General' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav(page).getByRole('link', { name: 'Advanced' })).toHaveAttribute(
      'href',
      '/wp-admin/options-general.php?page=acme-beta#/advanced',
    );

    // no document load: a marker on window survives the navigation
    await page.evaluate(() => ((window as unknown as { __stay: number }).__stay = 1));
    await nav(page).getByRole('link', { name: 'Advanced' }).click();
    await expect(h1(page)).toHaveText('Advanced');
    await expect(h1(page)).toBeFocused();
    expect(page.url()).toMatch(/options-general\.php\?page=acme-beta#\/advanced$/);
    expect(await page.evaluate(() => (window as unknown as { __stay?: number }).__stay)).toBe(1);

    await page.getByRole('tab', { name: /Debugging/ }).click();
    expect(page.url()).toMatch(/#\/advanced\/debug$/);
    await expect(page.getByRole('region', { name: 'Debugging' })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole('tab', { name: 'Cache' })).toHaveAttribute('aria-selected', 'true');
    await page.goBack();
    await expect(h1(page)).toHaveText('General');
    await page.goForward();
    await page.goForward();
    await expect(h1(page)).toHaveText('Advanced');
    await expect(page.getByRole('tab', { name: /Debugging/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(errors).toEqual([]);
  });

  test('deep links: a reload or a fresh load of `#/<page>/<tab>` opens that tab; an unknown route falls back in place', async ({
    page,
  }) => {
    await page.goto(`${SIDEBAR}#/advanced/debug`);
    await expect(page.getByRole('tab', { name: /Debugging/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.reload();
    await expect(page.getByRole('tab', { name: /Debugging/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.goto(`${SIDEBAR}#/nowhere/else`);
    await expect(h1(page)).toHaveText('General');
    expect(page.url()).toMatch(/#\/general$/);
  });

  test('the tabbed page saves per section through REST: each card sends only its own fields; values survive tabs and persist', async ({
    page,
  }) => {
    await page.goto(`${SIDEBAR}#/advanced`);
    await expect(page.getByRole('region', { name: 'Unsaved changes' })).toHaveCount(0); // no Save Bar on this page
    const cache = page.getByRole('region', { name: 'Page cache' });
    await expect(cache.getByRole('button', { name: 'Save' })).toBeDisabled();
    await cache.getByRole('textbox', { name: 'Cache lifetime' }).fill('120');
    await expect(cache.getByText('You have unsaved changes')).toBeVisible();

    await page.getByRole('tab', { name: /Debugging/ }).click();
    const debug = page.getByRole('region', { name: 'Debugging' });
    await debug.getByRole('switch', { name: 'Write a debug log' }).click();
    await page.getByRole('tab', { name: 'Cache' }).click();
    await expect(cache.getByRole('textbox', { name: 'Cache lifetime' })).toHaveValue('120'); // kept across tabs
    expect(await page.evaluate(() => document.querySelectorAll('[role=dialog]').length)).toBe(0); // tabs never ask

    const post = () =>
      page.waitForResponse(
        (r) => r.url().includes('/fyldo-acme-beta/v1/pages/advanced') && r.request().method() === 'POST',
      );
    let saved = post();
    await cache.getByRole('button', { name: 'Save' }).click();
    let response = await saved;
    expect(response.status()).toBe(200);
    expect(JSON.parse(response.request().postData() ?? '{}').values).toEqual({ cache_ttl: 120 }); // this card only
    await expect(cache.getByText('All changes saved')).toBeVisible();

    await page.getByRole('tab', { name: /Debugging/ }).click();
    await expect(debug.getByText('You have unsaved changes')).toBeVisible(); // still waiting for its own Save
    saved = post();
    await debug.getByRole('button', { name: 'Save' }).click();
    response = await saved;
    expect(response.status()).toBe(200); // based on the revision the first save returned: no 409
    expect(JSON.parse(response.request().postData() ?? '{}').values).toEqual({ debug_log: true });

    await page.reload(); // still on the Debugging tab (#/advanced/debug)
    await expect(page.getByRole('switch', { name: 'Write a debug log' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('tab', { name: 'Cache' }).click();
    await expect(page.getByRole('textbox', { name: 'Cache lifetime' })).toHaveValue('120');
  });

  test('an invalid field blocks its card’s save: the field is focused and the footer says why', async ({
    page,
  }) => {
    await page.goto(`${SIDEBAR}#/advanced/debug`);
    const debug = page.getByRole('region', { name: 'Debugging' });
    await debug.getByRole('textbox', { name: 'Log file prefix' }).fill('Not valid');
    await debug.getByRole('button', { name: 'Save' }).click();
    await expect(debug.getByRole('textbox', { name: 'Log file prefix' })).toBeFocused();
    await expect(debug.getByText('Couldn’t save. Check the highlighted fields.')).toBeVisible();
  });
});

test.describe('unsaved changes', () => {
  test('leaving a dirty page through the navigation asks first; Keep editing stays, Discard goes', async ({ page }) => {
    await page.goto(SIDEBAR);
    await page.getByRole('textbox', { name: 'Site title' }).fill('Unsaved');
    await nav(page).getByRole('link', { name: 'Advanced' }).click();
    const dialog = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeFocused();
    expect(page.url()).not.toMatch(/#\/advanced/); // still on General
    // portalled into the Fyldo root, over a scrim
    expect(await dialog.evaluate((el) => Boolean(el.closest('[data-fyldo-v1]')))).toBe(true);

    await dialog.getByRole('button', { name: 'Keep editing' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Site title' })).toHaveValue('Unsaved');

    await nav(page).getByRole('link', { name: 'Advanced' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Discard' }).click();
    await expect(h1(page)).toHaveText('Advanced');
    await expect(h1(page)).toBeFocused();
    await nav(page).getByRole('link', { name: 'General' }).click(); // clean again: no question
    await expect(page.getByRole('textbox', { name: 'Site title' })).toHaveValue('Fyldo');
  });

  test('Back from a dirty page asks too; the URL stays until the choice is made', async ({ page }) => {
    await page.goto(SIDEBAR);
    await nav(page).getByRole('link', { name: 'Advanced' }).click();
    await expect(h1(page)).toHaveText('Advanced');
    await page.getByRole('textbox', { name: 'Cache lifetime' }).fill('90');
    await page.goBack();
    const dialog = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
    await expect(dialog).toBeVisible();
    expect(page.url()).toMatch(/#\/advanced$/);
    await dialog.getByRole('button', { name: 'Discard' }).click();
    await expect(h1(page)).toHaveText('General');
    expect(page.url()).toMatch(/#\/general$/);
  });

  test('leaving the screen with unsaved edits asks the browser (beforeunload)', async ({ page }) => {
    await page.goto(SIDEBAR);
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(d.type());
      void d.accept();
    });
    await page.getByRole('textbox', { name: 'Site title' }).fill('Unsaved');
    const closed = new Promise((done) => page.once('close', done));
    await page.close({ runBeforeUnload: true });
    await closed;
    expect(dialogs).toEqual(['beforeunload']);
  });
});

test.describe('wp-admin integration (sidebar layout)', () => {
  test('bleed layout: the sidebar sits flush against the admin menu, fills the screen below the admin bar, and stays in view; no WP footer', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(SIDEBAR);
    const sidebar = page.locator('[data-slot=fy-sidebar]');
    const menu = await page.locator('#adminmenuwrap').boundingBox();
    const box = await sidebar.boundingBox();
    const bar = await page.locator('#wpadminbar').boundingBox();
    expect(Math.round(box!.x)).toBe(Math.round(menu!.x + menu!.width)); // no #wpcontent padding in between
    expect(Math.round(box!.y)).toBe(Math.round(bar!.height)); // right below the admin bar
    expect(Math.round(box!.width)).toBe(256);
    expect(Math.round(box!.height)).toBe(900 - Math.round(bar!.height));
    await expect(page.locator('#wpfooter')).toBeHidden();

    // the utility links sit at the bottom of the column
    const footer = await page.getByRole('navigation', { name: 'Resources' }).boundingBox();
    expect(Math.round(footer!.y + footer!.height)).toBe(900);

    // sticky: after scrolling the content, the sidebar is still right below the admin bar.
    // The page may fit the viewport (the `field` layout keeps rows short), so add height to the content column first.
    await page.locator('[data-slot=fy-section-card]').first().evaluate((card) => {
      const spacer = document.createElement('div');
      spacer.style.height = '1200px';
      card.parentElement?.append(spacer);
    });
    await page.mouse.wheel(0, 600);
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    expect(Math.round((await sidebar.boundingBox())!.y)).toBe(Math.round(bar!.height));

    // the content column is 800px, centred in the main area
    const card = await page.locator('[data-slot=fy-section-card]').first().boundingBox();
    expect(Math.round(card!.width)).toBe(800);
    const main = 1440 - (box!.x + box!.width);
    expect(Math.abs(card!.x - (box!.x + box!.width) - (main - 800) / 2)).toBeLessThanOrEqual(1);
  });

  test('groups, the nav badge and the utility links (opening a new tab, announced)', async ({
    page,
  }) => {
    await page.goto(SIDEBAR);
    await expect(nav(page).getByRole('list', { name: 'Settings' }).getByRole('link')).toHaveText([
      'General',
      'Content3',
    ]);
    await expect(nav(page).getByRole('list', { name: 'Tools' }).getByRole('link')).toHaveText([
      'Advanced',
    ]);
    const docs = page
      .getByRole('navigation', { name: 'Resources' })
      .getByRole('link', { name: 'Documentation (opens in a new tab)' });
    await expect(docs).toHaveAttribute('target', '_blank');
    await expect(docs).toHaveAttribute('href', 'https://example.com/docs');
  });

  test('at 782px and below the sidebar becomes a Menu disclosure (46px admin bar, no sideways scrolling)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await page.goto(SIDEBAR);
    await expect(page.locator('[data-slot=fy-sidebar-column]')).toHaveCount(0);
    const menu = page.getByRole('button', { name: 'Menu' });
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await nav(page).getByRole('link', { name: 'Advanced' }).click();
    await expect(h1(page)).toHaveText('Advanced');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(Math.round((await page.locator('#wpadminbar').boundingBox())!.height)).toBe(46);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/wp-nav-mobile.png', fullPage: true });
  });
});

test.describe('top navigation layout', () => {
  test('the pages are links in a row with the brand and utilities above; routing works the same', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(TOP);
    await expect(page.locator('[data-slot=fy-sidebar]')).toHaveCount(0);
    const topNav = page.locator('[data-slot=fy-top-nav]');
    const bar = await page.locator('#wpadminbar').boundingBox();
    const box = await topNav.boundingBox();
    const menu = await page.locator('#adminmenuwrap').boundingBox();
    expect(Math.round(box!.y)).toBe(Math.round(bar!.height));
    expect(Math.round(box!.x)).toBe(Math.round(menu!.x + menu!.width));
    expect(Math.round(box!.height)).toBe(96);
    await expect(nav(page, 'Acme Gamma').getByRole('link', { name: 'General' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('list', { name: 'Resources' }).getByRole('link')).toHaveCount(2);
    await expect(page.locator('[data-slot=fy-page-header-actions]')).toHaveCount(0);

    await nav(page, 'Acme Gamma').getByRole('link', { name: 'Advanced' }).click();
    await expect(h1(page)).toHaveText('Advanced');
    expect(page.url()).toMatch(/options-general\.php\?page=acme-gamma#\/advanced$/);
    await page.goBack();
    await expect(h1(page)).toHaveText('General');
    await page.screenshot({ path: 'test-results/wp-top-nav.png' });
  });
});

test.describe('Persian (RTL)', () => {
  test('the sidebar is on the right, links keep the locale argument, Persian numerals and strings', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(FA);
    const sidebar = await page.locator('[data-slot=fy-sidebar]').boundingBox();
    const card = await page.locator('[data-slot=fy-section-card]').first().boundingBox();
    const menu = await page.locator('#adminmenuwrap').boundingBox();
    expect(sidebar!.x).toBeGreaterThan(card!.x); // mirrored: the sidebar is at the right
    expect(Math.round(sidebar!.x + sidebar!.width)).toBe(Math.round(menu!.x)); // flush against the (right-hand) admin menu

    const advanced = nav(page).getByRole('link', { name: 'Advanced' });
    await expect(advanced).toHaveAttribute(
      'href',
      '/wp-admin/options-general.php?page=acme-beta&fyldo_locale=fa_IR#/advanced',
    );
    await expect(nav(page).getByRole('link', { name: /Content/ })).toContainText('۳');
    await expect(page.getByRole('navigation', { name: 'منابع' })).toBeVisible();

    await advanced.click();
    await expect(h1(page)).toHaveText('Advanced');
    await expect(page.getByRole('tab', { name: /Debugging/ })).toContainText('۲');
    // the first tab is at the right
    const cache = await page.getByRole('tab', { name: 'Cache' }).boundingBox();
    const debug = await page.getByRole('tab', { name: /Debugging/ }).boundingBox();
    expect(cache!.x).toBeGreaterThan(debug!.x);
    await page.screenshot({ path: 'test-results/wp-nav-fa.png' });
  });
});
