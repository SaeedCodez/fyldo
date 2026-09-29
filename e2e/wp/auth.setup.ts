import { expect, test as setup } from '@playwright/test';

/** Logs in once (wp-env default admin/password) and stores the session for the `wp` project. */
setup('log in to wp-admin', async ({ page }) => {
  const user = process.env.WP_USER ?? 'admin';
  const password = process.env.WP_PASSWORD ?? 'password';

  await page.goto('/wp-login.php', { waitUntil: 'load' });
  // WordPress's login script can re-render the fields after load: retry the fill until it sticks.
  await expect(async () => {
    await page.locator('#user_login').fill(user);
    await page.locator('#user_pass').fill(password);
    await expect(page.locator('#user_pass')).toHaveValue(password);
  }).toPass();
  await page.locator('#wp-submit').click();

  await expect(page.locator('#wpadminbar')).toBeVisible();
  await page.context().storageState({ path: 'e2e/.auth/admin.json' });
});
