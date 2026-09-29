import { expect, test } from '@playwright/test';

test('renders the slice page from the static harness', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/tests/harness/');
  await expect(page.getByRole('heading', { level: 1, name: 'General' })).toBeVisible();
  await page.screenshot({ path: 'test-results/harness-en.png', fullPage: true });
  expect(errors).toEqual([]);
});
