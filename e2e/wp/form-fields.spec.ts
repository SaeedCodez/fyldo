/**
 * Milestone 2 fields on a real WordPress: Textarea (counter), Checkbox, Checkbox group (parent), Radio group, Multi Select.
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
  test('Multi Select: pick, remove, clear and save through REST; the list persists in option order', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(EN);

    const field = page.getByRole('combobox', { name: 'Include in sitemap' });
    await expect(field).toContainText('PostsPages'); // the defaults, as tags
    await expect(field.getByRole('button', { name: 'Remove Posts' })).toBeVisible();

    // open, type to filter, tick with the keyboard
    await field.focus();
    await page.keyboard.press('Enter');
    const popup = page.getByRole('dialog');
    const search = popup.getByRole('combobox', { name: 'Search options' });
    await expect(search).toBeFocused();
    await page.keyboard.type('a');
    await expect(page.getByRole('option')).toHaveText(['Pages', 'Authors', 'Categories', 'Tags', 'Media']);
    await page.getByRole('option', { name: 'Tags' }).click();
    await page.getByRole('option', { name: 'Authors' }).click();
    await expect(popup.getByText('4 selected')).toBeVisible();
    await page.screenshot({ path: 'test-results/wp-multi-select-en-open.png' });
    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();
    await expect(field).toBeFocused();

    // Backspace on the closed field removes the last tag (option order: Posts, Pages, Authors, Tags → Tags goes)
    await page.keyboard.press('Backspace');
    await expect(field.getByRole('button', { name: 'Remove Tags' })).toHaveCount(0);
    await expect(page.getByText('You have unsaved changes')).toBeVisible();
    await page.screenshot({ path: 'test-results/wp-multi-select-en.png' });

    await save(page);
    await expect(page.getByText('All changes saved')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Include in sitemap' })).toContainText('PostsPagesAuthors');
    expect(errors).toEqual([]);
  });

  test('Multi Select: `max: 5` and an empty selection (`min: 1`) are enforced before anything is sent', async ({ page }) => {
    await page.goto(EN);
    const field = page.getByRole('combobox', { name: 'Include in sitemap' });
    await field.click();
    for (const name of ['Products', 'Authors', 'Categories', 'Tags']) await page.getByRole('option', { name }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Select no more than 5 options.')).toBeVisible();
    await save(page);
    await expect(page.getByText('All changes saved')).toHaveCount(0);

    // "+n": six selected (two defaults + four picked), three tags shown
    await expect(field.locator('[data-slot=fy-tag]')).toHaveCount(4);
    await expect(field.locator('[data-slot=fy-tag]').last()).toContainText('+3');

    // Clear all, then the minimum applies
    await field.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Clear all' }).click();
    await expect(page.getByText('0 selected')).toBeVisible();
    await page.keyboard.press('Escape');
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
  test('multi_select: only enabled options, the count rules, stored in option order', async ({ request }) => {
    let response = await patch(request, { sitemap_types: ['post', 'comment'] }); // Comments is a disabled option
    expect(response.status()).toBe(422);
    expect((await response.json()).data.errors.sitemap_types).toBe('Choose one of the available options.');

    response = await patch(request, { sitemap_types: ['post', 'page', 'product', 'author', 'category', 'tag'] });
    expect(response.status()).toBe(422);
    expect((await response.json()).data.errors.sitemap_types).toBe('Select no more than 5 options.');

    response = await patch(request, { sitemap_types: [] });
    expect(response.status()).toBe(422);
    expect((await response.json()).data.errors.sitemap_types).toBe('Select at least 1 option.');

    response = await patch(request, { sitemap_types: ['tag', 'post', 'tag'] });
    expect(response.status()).toBe(200);
    expect((await response.json()).values.sitemap_types).toEqual(['post', 'tag']);
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
  test('Multi Select: tags flow from the right, the chevron and the popup mirror, Persian text and numerals', async ({ page }) => {
    await page.goto(FA);
    const field = page.getByRole('combobox', { name: 'Include in sitemap' });
    const box = await field.boundingBox();
    const first = await field.locator('[data-slot=fy-tag]').first().boundingBox();
    const second = await field.locator('[data-slot=fy-tag]').nth(1).boundingBox();
    const chevron = await field.locator('[data-slot=fy-multi-icons]').boundingBox();
    expect(box!.x + box!.width - (first!.x + first!.width)).toBeLessThan(12); // the first tag sits at the START (right)
    expect(second!.x).toBeLessThan(first!.x); // real RTL flow: later tags go leftwards
    expect(chevron!.x - box!.x).toBeLessThan(box!.x + box!.width - (chevron!.x + chevron!.width)); // the chevron is at the END (left)

    await field.click();
    const popup = page.getByRole('dialog');
    await expect(popup.getByRole('combobox', { name: /جستجو/ })).toBeFocused();
    await expect(popup.getByText('۲ مورد انتخاب شده')).toBeVisible();
    await expect(popup.getByRole('button', { name: 'پاک کردن همه' })).toBeVisible();
    // the checkbox column is at the start (right) of the rows
    const option = await page.getByRole('option').first().boundingBox();
    const mark = await page.getByRole('option').first().locator('[data-slot=fy-checkbox]').boundingBox();
    expect(option!.x + option!.width - (mark!.x + mark!.width)).toBeCloseTo(8, 0);

    for (const name of ['Products', 'Authors', 'Categories', 'Tags']) await page.getByRole('option', { name }).click(); // 2 + 4 = 6 > max 5
    await page.keyboard.press('Escape');
    await expect(field.locator('[data-slot=fy-tag]').last()).toContainText('+۳'); // Persian numerals
    await save(page);
    await expect(page.getByText('حداکثر 5 گزینه را می‌توانید انتخاب کنید.')).toBeVisible();
    await page.screenshot({ path: 'test-results/wp-multi-select-fa.png' });
  });
});
