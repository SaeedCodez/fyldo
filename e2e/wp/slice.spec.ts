import { expect, test } from '@playwright/test';
import { settingsUrl, resetData } from './helpers';

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

test('the M1 slice renders, edits, saves through REST and persists', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(settingsUrl('acme-beta'));
  await expect(page.getByRole('heading', { level: 1, name: 'General' })).toBeVisible();
  await page.screenshot({ path: 'test-results/wp-slice.png', fullPage: false });

  const title = page.getByRole('textbox', { name: 'Site title' });
  await expect(title).toHaveValue('Fyldo');
  await title.fill('Acme Blog');
  await expect(page.getByText('You have unsaved changes')).toBeVisible();

  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('All changes saved')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Site title' })).toHaveValue('Acme Blog');
  expect(errors).toEqual([]);
});

test('a save based on stale values is refused (409): the edits stay, a notice explains, and Reload shows the latest', async ({ page, context }) => {
  await page.goto(settingsUrl('acme-beta'));
  const other = await context.newPage(); // the same screen in another tab
  await other.goto(settingsUrl('acme-beta'));

  await other.getByRole('textbox', { name: 'Site title' }).fill('Saved elsewhere');
  await other.getByRole('button', { name: 'Save changes' }).click();
  await expect(other.getByText('All changes saved')).toBeVisible();

  await page.getByRole('textbox', { name: 'Tagline' }).fill('Mine');
  const refused = page.waitForResponse((r) => r.url().includes('/fyldo-acme-beta/v1/pages/general') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Save changes' }).click();
  expect((await refused).status()).toBe(409);

  const bar = page.getByRole('region', { name: 'Unsaved changes' });
  await expect(bar.getByText('Couldn’t save: these settings were changed somewhere else.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Tagline' })).toHaveValue('Mine'); // nothing lost behind the user's back
  const notice = page.getByRole('region', { name: 'Warning: These settings were changed somewhere else' });
  await expect(notice).toBeVisible();

  const reloaded = page.waitForResponse((r) => r.url().includes('/fyldo-acme-beta/v1/pages/general') && r.request().method() === 'GET');
  await notice.getByRole('button', { name: 'Reload latest values' }).click();
  expect((await reloaded).status()).toBe(200);
  await expect(page.getByRole('textbox', { name: 'Site title' })).toHaveValue('Saved elsewhere');
  await expect(notice).toHaveCount(0);

  // the next save is based on the latest revision
  await page.getByRole('textbox', { name: 'Tagline' }).fill('Mine again');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('All changes saved')).toBeVisible();
  await other.close();
});
