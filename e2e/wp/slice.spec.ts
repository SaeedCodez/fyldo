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
