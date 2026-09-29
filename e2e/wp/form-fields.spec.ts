/**
 * Milestone 2 fields on a real WordPress: Textarea (counter), Checkbox, Checkbox group (parent), Radio group.
 * The page is tests/fixtures/form-fields-page.php, registered by every demo plugin as page `fields` (route `#/fields`).
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readConfig, resetData, settingsUrl } from './helpers';

const EN = `${settingsUrl('acme-beta')}#/fields`;
const FA = `${settingsUrl('acme-beta', '&fyldo_locale=fa_IR')}#/fields`;

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

const save = (page: Page) => page.getByRole('button', { name: /Save changes|ذخیرهٔ تغییرات/ }).click();

test.describe('English', () => {
  test('renders the defaults, edits every control, saves through REST and persists', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(EN);
    await expect(page.getByRole('heading', { level: 1, name: 'Content' })).toBeVisible();

    const meta = page.getByRole('textbox', { name: 'Default meta description' });
    await expect(meta).toHaveValue('Fyldo is a lightweight settings framework.');
    await expect(page.locator('[data-slot=fy-counter]')).toHaveText('42/160');
    await expect(page.getByRole('checkbox', { name: 'All post types' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('checkbox', { name: 'Products' })).toHaveAttribute('data-disabled', '');
    await expect(page.getByRole('radio', { name: 'Full width' })).toHaveAttribute('aria-checked', 'true');

    await meta.fill('Line one\nLine two');
    await expect(page.locator('[data-slot=fy-counter]')).toHaveText('17/160'); // a line break is one character
    await page.getByRole('checkbox', { name: 'Pages' }).click();
    await expect(page.getByRole('checkbox', { name: 'All post types' })).toHaveAttribute('aria-checked', 'mixed');
    await page.getByRole('radio', { name: 'Boxed' }).click();
    await page.getByRole('checkbox', { name: 'I agree to the terms' }).click();
    await expect(page.getByText('You have unsaved changes')).toBeVisible();
    await page.screenshot({ path: 'test-results/wp-fields-en.png' });

    await save(page);
    await expect(page.getByText('All changes saved')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Default meta description' })).toHaveValue('Line one\nLine two');
    await expect(page.getByRole('checkbox', { name: 'Posts' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('checkbox', { name: 'Pages' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('radio', { name: 'Boxed' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('checkbox', { name: 'I agree to the terms' })).toHaveAttribute('aria-checked', 'true');
    expect(errors).toEqual([]);
  });

  test('over the limit: counter in error, text kept, the save is blocked with the same wording PHP uses', async ({ page }) => {
    await page.goto(EN);
    const meta = page.getByRole('textbox', { name: 'Default meta description' });
    await meta.fill('x'.repeat(172));
    await expect(page.locator('[data-slot=fy-counter]')).toHaveText('172/160');
    await save(page);
    await expect(page.getByText('Use no more than 160 characters.')).toBeVisible();
    await expect(meta).toHaveValue('x'.repeat(172)); // never truncated
    await expect(meta).toBeFocused();
    await page.screenshot({ path: 'test-results/wp-fields-en-error.png' });
  });

  test('a group can be emptied only when its rule allows it (min: 1) — client and server agree', async ({ page }) => {
    await page.goto(EN);
    await page.getByRole('checkbox', { name: 'Posts' }).click();
    await page.getByRole('checkbox', { name: 'Pages' }).click();
    await page.getByRole('checkbox', { name: 'I agree to the terms' }).focus(); // leaves the group → validation on blur
    await expect(page.getByText('Select at least 1 option.')).toBeVisible();
  });
});

test.describe('REST (server is authoritative)', () => {
  let headers: Record<string, string> = {};
  let revision = '';
  const patch = (request: APIRequestContext, values: unknown) =>
    request.post('/index.php?rest_route=/fyldo-acme-beta/v1/pages/fields', { headers: { 'X-HTTP-Method-Override': 'PATCH', ...headers }, data: { values, revision } });

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await context.newPage();
    await resetData(context.request);
    await page.goto(EN);
    const config = await readConfig(page, 'acme-beta');
    headers = { 'X-WP-Nonce': config.rest.nonce, 'X-Fyldo-Nonce': config.rest.instanceNonce };
    revision = config.pages.find((p: { id: string }) => p.id === 'fields').revision;
    await context.close();
  });

  test('every rule is enforced, per field, in one 422', async ({ request }) => {
    const response = await patch(request, { meta_description: 'x'.repeat(161), post_types: [], layout: 'stretched', post_types_extra: 1 });
    expect(response.status()).toBe(422);
    expect((await response.json()).data.errors).toEqual({
      meta_description: 'Use no more than 160 characters.',
      post_types: 'Select at least 1 option.',
      layout: 'Choose one of the available options.',
    });
  });

  test('a disabled option and an unknown option are rejected; the list is stored in option order', async ({ request }) => {
    let response = await patch(request, { post_types: ['post', 'product'] });
    expect(response.status()).toBe(422);
    expect((await response.json()).data.errors.post_types).toBe('Choose one of the available options.');

    response = await patch(request, { post_types: ['page', 'post'], agree: 'true', layout: 'boxed', meta_description: '<b>Bold</b>\nnext' });
    expect(response.status()).toBe(200);
    expect((await response.json()).values).toMatchObject({ post_types: ['post', 'page'], agree: true, layout: 'boxed', meta_description: 'Bold\nnext' });
  });
});

test.describe('Persian (RTL)', () => {
  test('strings, numerals, mirrored geometry', async ({ page }) => {
    await page.goto(FA);
    const root = page.locator('[data-fyldo-v1="acme-beta"]');
    await expect(root).toHaveAttribute('dir', 'rtl');

    // numerals follow the page language
    await expect(page.locator('[data-slot=fy-counter]')).toHaveText('۴۲/۱۶۰');

    // checkbox: the box sits at the START (right) of its label; children are indented toward the reading direction
    const parent = await page.getByRole('checkbox', { name: 'All post types' }).boundingBox();
    const parentLabel = await page.getByText('All post types', { exact: true }).boundingBox();
    const child = await page.getByRole('checkbox', { name: 'Posts' }).boundingBox();
    expect(parent!.x).toBeGreaterThan(parentLabel!.x);
    expect(parent!.x + parent!.width - (child!.x + child!.width)).toBeCloseTo(24, 0); // 24px indent from the right edge

    // radio: the circle is right of its label
    const radio = await page.getByRole('radio', { name: 'Full width' }).boundingBox();
    const radioLabel = await page.getByText('Full width', { exact: true }).boundingBox();
    expect(radio!.x).toBeGreaterThan(radioLabel!.x);

    // Persian validation messages (client: bundled JED; server: .mo)
    await page.getByRole('textbox', { name: 'Default meta description' }).fill('x'.repeat(161));
    await expect(page.locator('[data-slot=fy-counter]')).toHaveText('۱۶۱/۱۶۰');
    await save(page);
    await expect(page.getByText('حداکثر 160 نویسه مجاز است.')).toBeVisible();

    await page.getByRole('checkbox', { name: 'Posts' }).click();
    await page.getByRole('checkbox', { name: 'Pages' }).click();
    await page.getByRole('textbox', { name: 'Default meta description' }).focus();
    await expect(page.getByText('دست‌کم 1 گزینه را انتخاب کنید.')).toBeVisible();
    await page.screenshot({ path: 'test-results/wp-fields-fa.png' });
  });
});
