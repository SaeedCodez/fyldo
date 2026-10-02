/**
 * Milestone 2 fields on a real WordPress: Textarea (counter), Checkbox, Checkbox group (parent), Radio group, Multi Select,
 * and the input fields: URL, email, password (write-only), number, notice, a disabled field with its reason, plus a
 * Segmented Control, a Slider, a Color Picker and an Icon Picker (their panel / modal are lazily loaded chunks).
 * The page is tests/fixtures/form-fields-page.php, registered by every demo plugin as page `fields` (route `#/fields`).
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readConfig, resetData, settingsUrl } from './helpers';

const EN = `${settingsUrl('acme-beta')}#/fields`;
const FA = `${settingsUrl('acme-beta', '&fyldo_locale=fa_IR')}#/fields`;

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

const save = (page: Page) => page.getByRole('button', { name: /Save changes|ذخیره‌ی تغییرات/ }).click();

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
    await expect(page.getByRole('radiogroup', { name: 'Sort products' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'By product' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radiogroup', { name: 'Dashboard density' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Comfortable' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('slider', { name: 'Image quality' })).toHaveAttribute('aria-valuetext', '75');
    const accent = page.getByRole('button', { name: 'Accent color' });
    await expect(accent).toHaveText('#2271B1');

    await meta.fill('Line one\nLine two');
    await expect(page.locator('[data-slot=fy-counter]')).toHaveText('17/160'); // a line break is one character
    await page.getByRole('checkbox', { name: 'Pages' }).click();
    await expect(page.getByRole('checkbox', { name: 'All post types' })).toHaveAttribute('aria-checked', 'mixed');
    await page.getByRole('radio', { name: 'Boxed' }).click();
    await page.getByRole('checkbox', { name: 'I agree to the terms' }).click();
    await page.getByRole('radio', { name: 'By order' }).click();
    await page.getByRole('radio', { name: 'Spacious' }).click(); // a Choice Card
    await expect(page.getByRole('radio', { name: 'Comfortable' })).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('slider', { name: 'Image quality' }).focus();
    await page.keyboard.press('ArrowRight'); // one step of 5
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('slider', { name: 'Image quality' })).toHaveAttribute('aria-valuetext', '85');
    await accent.click();
    await page.getByRole('radio', { name: '#d63638' }).click(); // a preset from the lazily loaded panel
    await expect(page.getByRole('textbox', { name: 'Hex color' })).toHaveValue('#D63638');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(accent).toBeFocused();
    await expect(accent).toHaveText('#D63638');
    const menuIcon = page.getByRole('button', { name: 'Menu icon' });
    await expect(menuIcon).toHaveText('home-2');
    await menuIcon.click();
    await page.getByRole('option', { name: 'star' }).click(); // a tile of the lazily loaded modal (the field offers 4 icons)
    await expect(menuIcon).toHaveText('home-2'); // nothing changes until "Select icon"
    await page.getByRole('button', { name: 'Select icon' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(menuIcon).toBeFocused();
    await expect(menuIcon).toHaveText('star');
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
    await expect(page.getByRole('radio', { name: 'By order' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'Spacious' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('slider', { name: 'Image quality' })).toHaveAttribute('aria-valuetext', '85');
    await expect(page.getByRole('button', { name: 'Accent color' })).toHaveText('#D63638');
    await expect(page.getByRole('button', { name: 'Menu icon' })).toHaveText('star');
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

  test('input fields: Persian digits are read, the password is write-only, the notice and the disabled field are never sent', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(EN);

    // static rendering: a notice, LTR URL/email, a password input, a number, a disabled field with its reason
    await expect(page.getByRole('region', { name: 'Information: Before you connect' })).toContainText('Keys are stored in the database');
    await expect(page.getByRole('textbox', { name: 'Canonical URL' })).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('textbox', { name: 'Contact email' })).toHaveAttribute('dir', 'ltr');
    const key = page.getByLabel('API key');
    await expect(key).toHaveAttribute('type', 'password');
    await expect(key).toHaveAttribute('autocomplete', 'new-password');
    await expect(page.getByRole('textbox', { name: 'Items per page' })).toHaveValue('10');
    const license = page.getByRole('textbox', { name: 'License key' });
    await expect(license).toBeDisabled();
    await expect(license).toHaveAccessibleDescription('Managed by your hosting provider.');

    // Persian and Arabic-Indic digits are read as ASCII as they are typed
    const perPage = page.getByRole('textbox', { name: 'Items per page' });
    await perPage.fill('');
    await perPage.pressSequentially('۴٥');
    await expect(perPage).toHaveValue('45');
    await page.getByRole('textbox', { name: 'Canonical URL' }).pressSequentially('https://example.com/۱۲');
    await expect(page.getByRole('textbox', { name: 'Canonical URL' })).toHaveValue('https://example.com/12');
    await page.getByRole('textbox', { name: 'Contact email' }).pressSequentially('mo۱@example.com');
    await key.fill('sk_live_secret_value');
    await page.screenshot({ path: 'test-results/wp-input-fields-en.png' });

    const sent = page.waitForRequest((r) => r.url().includes('fyldo-acme-beta') && r.method() === 'POST');
    await save(page);
    const payload = (await sent).postDataJSON() as { values: Record<string, unknown> };
    expect(payload.values).toEqual({ per_page: 45, canonical_base: 'https://example.com/12', contact_email: 'mo1@example.com', api_key: 'sk_live_secret_value' });
    await expect(page.getByText('All changes saved')).toBeVisible();

    // the secret never comes back: not in the response, not in the page, not in the field
    await page.reload();
    expect(await page.content()).not.toContain('sk_live_secret_value');
    await expect(page.getByLabel('API key')).toHaveValue('');
    await expect(page.getByLabel('API key')).toHaveAttribute('placeholder', '•••• set');
    await expect(page.getByRole('textbox', { name: 'Items per page' })).toHaveValue('45');
    await expect(page.getByRole('textbox', { name: 'Canonical URL' })).toHaveValue('https://example.com/12');

    // leaving it alone keeps it; emptying it clears it
    await page.getByRole('checkbox', { name: 'I agree to the terms' }).click();
    await save(page);
    await expect(page.getByText('All changes saved')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('API key')).toHaveAttribute('placeholder', '•••• set');

    await page.getByLabel('API key').pressSequentially('x');
    await page.getByLabel('API key').fill('');
    await save(page);
    await expect(page.getByText('All changes saved')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('API key')).toHaveAttribute('placeholder', '');
    expect(errors).toEqual([]);
  });

  test('number: min, max, step and unreadable text are caught in the browser with the same wording PHP uses', async ({ page }) => {
    await page.goto(EN);
    const perPage = page.getByRole('textbox', { name: 'Items per page' });
    for (const [typed, message] of [
      ['۴۲', 'Enter a value in steps of 5.'],
      ['200', 'Enter a value of at most 100.'],
      ['0', 'Enter a value of at least 5.'],
      ['abc', 'Enter a number.'],
    ] as const) {
      await perPage.fill(typed);
      await page.getByRole('textbox', { name: 'Contact email' }).focus(); // leaves the field: validation on blur
      await expect(page.getByText(message)).toBeVisible();
    }
    await save(page);
    await expect(page.getByText('All changes saved')).toHaveCount(0);
    await expect(perPage).toBeFocused();
  });

  test('danger zone: "Reset settings" is confirmed with the Danger modal (typed keyword), sent through REST and resets the page to its defaults', async ({ page }) => {
    await page.goto(EN);
    const meta = page.getByRole('textbox', { name: 'Default meta description' });
    await meta.fill('Saved earlier');
    await save(page);
    await expect(page.getByText('All changes saved')).toBeVisible();
    await page.reload();
    await expect(meta).toHaveValue('Saved earlier');

    // an unsaved edit is dropped by the reset, as the confirmation says
    await meta.fill('Unsaved edit');
    const card = page.getByRole('region', { name: 'Reset settings' });
    await expect(card.getByText('This action can’t be undone.')).toBeVisible();
    await card.getByRole('button', { name: 'Reset settings' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Reset all settings?' });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((el) => Boolean(el.closest('[data-fyldo-v1]')))).toBe(true); // portalled into the Fyldo root
    const confirm = dialog.getByRole('button', { name: 'Reset settings' });
    await expect(confirm).toBeDisabled();
    const keyword = dialog.getByRole('textbox', { name: 'Type RESET to confirm' });
    await expect(keyword).toBeFocused();

    // the modal's close button has a tooltip (design rule 10); the scrim does not close a Danger modal, Esc is Cancel
    await keyword.press('Shift+Tab'); // keyboard focus opens a tooltip at once
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await expect(page.locator('[data-fyldo-v1] [data-slot=fy-tooltip]', { hasText: 'Close' })).toBeVisible();
    await page.mouse.click(4, 400);
    await expect(dialog).toBeVisible();

    await keyword.fill('reset');
    await expect(confirm).toBeDisabled(); // case-sensitive
    await keyword.fill('RESET');
    await expect(confirm).toBeEnabled();

    const request = page.waitForRequest((r) => r.url().includes('/pages/fields/actions/reset'));
    const response = page.waitForResponse((r) => r.url().includes('/pages/fields/actions/reset'));
    await confirm.click();
    const sent = await request;
    expect(sent.method()).toBe('POST');
    expect(sent.headers()['x-wp-nonce']).toBeTruthy();
    expect(sent.headers()['x-fyldo-nonce']).toBeTruthy();
    expect(sent.postDataJSON()).toEqual({ keyword: 'RESET' });
    expect((await response).status()).toBe(200);

    await expect(dialog).toHaveCount(0);
    await expect(meta).toHaveValue('Fyldo is a lightweight settings framework.'); // the default, and the unsaved edit is gone
    await expect(page.getByText('You have unsaved changes')).toHaveCount(0);
    const toast = page.locator('[data-fyldo-v1] [data-slot=fy-toast]');
    await expect(toast).toContainText('Settings reset to defaults'); // drawn inside the root
    await expect(page.getByRole('region', { name: 'Notifications' })).toBeAttached(); // the live-region landmark (zero-size: toasts are positioned inside it)

    await page.reload();
    await expect(meta).toHaveValue('Fyldo is a lightweight settings framework.'); // stored: the option is gone
  });

  test('danger zone: Cancel changes nothing', async ({ page }) => {
    await page.goto(EN);
    await page.getByRole('textbox', { name: 'Default meta description' }).fill('Kept');
    await save(page);
    await expect(page.getByText('All changes saved')).toBeVisible();

    await page.getByRole('region', { name: 'Reset settings' }).getByRole('button', { name: 'Reset settings' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    // Esc is Cancel too: it closes the dialog and confirms nothing
    await page.getByRole('region', { name: 'Reset settings' }).getByRole('button', { name: 'Reset settings' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Default meta description' })).toHaveValue('Kept');
  });

  test('notices queued with admin_notice() are drawn in Fyldo’s own slot, never as core `.notice`; a dismissible one goes away, a warning stays', async ({ page }) => {
    await page.goto(EN);
    const root = page.locator('[data-fyldo-v1="acme-beta"]');
    const slot = root.locator('[data-slot=fy-notices]');
    await expect(slot).toBeVisible();

    // most severe first: the warning, then the blue update notice with its action
    const regions = slot.getByRole('region');
    await expect(regions).toHaveCount(2);
    await expect(regions.nth(0)).toHaveAccessibleName('Warning');
    await expect(regions.nth(0)).toContainText('Your license expires in 7 days.');
    await expect(regions.nth(1)).toHaveAccessibleName('Information: Update available');
    await expect(regions.nth(1).getByRole('link', { name: /View changelog/ })).toHaveAttribute('href', 'https://example.com/changes');

    // WordPress core JS relocates every `.notice` under the first heading of `.wrap`: there is none of ours to move
    await expect(page.locator('.notice, .updated, .error').locator('visible=true')).toHaveCount(0);
    expect(await slot.evaluate((el) => el.querySelectorAll('.notice, [class*="notice-"]').length)).toBe(0);

    await expect(regions.nth(0).getByRole('button', { name: 'Dismiss' })).toHaveCount(0); // warnings stay until resolved
    await regions.nth(1).getByRole('button', { name: 'Dismiss' }).click();
    await expect(regions).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: 'Content' })).toBeFocused();

    // only on the `fields` page
    await page.getByRole('navigation', { name: 'Acme Beta' }).getByRole('link', { name: 'General' }).click();
    await expect(root.locator('[data-slot=fy-notices]')).toHaveCount(0);
  });
});

test.describe('REST (server is authoritative)', () => {
  let headers: Record<string, string> = {};
  let revision = '';
  let initialRevision = '';
  const patch = (request: APIRequestContext, values: unknown) =>
    request.post('/index.php?rest_route=/fyldo-acme-beta/v1/pages/fields', { headers: { 'X-HTTP-Method-Override': 'PATCH', ...headers }, data: { values, revision } });

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await context.newPage();
    await resetData(context.request);
    await page.goto(EN);
    const config = await readConfig(page, 'acme-beta');
    headers = { 'X-WP-Nonce': config.rest.nonce, 'X-Fyldo-Nonce': config.rest.instanceNonce };
    initialRevision = config.pages.find((p: { id: string }) => p.id === 'fields').revision;
    await context.close();
  });

  // every test starts from freshly reset data, so from the revision of an empty option
  test.beforeEach(() => {
    revision = initialRevision;
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

  test('number: Persian digits are read, min / max / step / text are enforced, stored as a number', async ({ request }) => {
    let response = await patch(request, { per_page: '۴۲' });
    expect(response.status()).toBe(422);
    expect((await response.json()).data.errors.per_page).toBe('Enter a value in steps of 5.');

    response = await patch(request, { per_page: '٢٠٠' });
    expect((await response.json()).data.errors.per_page).toBe('Enter a value of at most 100.');
    response = await patch(request, { per_page: 0 });
    expect((await response.json()).data.errors.per_page).toBe('Enter a value of at least 5.');
    response = await patch(request, { per_page: 'ten' });
    expect((await response.json()).data.errors.per_page).toBe('Enter a number.');

    response = await patch(request, { per_page: '۵۵' });
    expect(response.status()).toBe(200);
    expect((await response.json()).values.per_page).toBe(55);
  });

  test('url and email: digits are read as ASCII; the https-only rule and email format are enforced', async ({ request }) => {
    let response = await patch(request, { canonical_base: 'http://example.com', contact_email: 'nope' });
    expect(response.status()).toBe(422);
    expect((await response.json()).data.errors).toEqual({ canonical_base: 'Enter a valid URL.', contact_email: 'Enter a valid email address.' });

    response = await patch(request, { canonical_base: 'https://۱۲۳.example.com/۴', contact_email: 'mo۱@example.com' });
    expect(response.status()).toBe(200);
    expect((await response.json()).values).toMatchObject({ canonical_base: 'https://123.example.com/4', contact_email: 'mo1@example.com' });
  });

  test('password is write-only: never returned, null keeps it, "" clears it, rules apply to a new value', async ({ request }) => {
    let response = await patch(request, { api_key: 'short' });
    expect(response.status()).toBe(422);
    expect((await response.json()).data.errors.api_key).toBe('Use at least 8 characters.');

    response = await patch(request, { api_key: ' spaces stay ' });
    expect(response.status()).toBe(200);
    let body = await response.json();
    expect(body.values.api_key).toBeNull(); // "a value is set" — never the value
    expect(JSON.stringify(body)).not.toContain('spaces stay');

    revision = body.revision;
    response = await patch(request, { api_key: null, per_page: 15 });
    expect(response.status()).toBe(200);
    body = await response.json();
    expect(body.values.api_key).toBeNull(); // kept

    revision = body.revision;
    response = await patch(request, { api_key: '' });
    expect(response.status()).toBe(200);
    expect((await response.json()).values.api_key).toBe(''); // cleared
  });

  test('a notice and a disabled field are not writable and not stored, even when a request names them', async ({ request }) => {
    const response = await patch(request, { connection_note: 'x', license_key: 'HACKED', per_page: 20 });
    expect(response.status()).toBe(200);
    const values = (await response.json()).values;
    expect(values.license_key).toBe('FYLDO-FREE');
    expect(values.per_page).toBe(20);
    expect(Object.keys(values)).not.toContain('connection_note');
  });

  const action = (request: APIRequestContext, data: unknown, extra: Record<string, string> = headers, name = 'reset') =>
    request.post(`/index.php?rest_route=/fyldo-acme-beta/v1/pages/fields/actions/${name}`, { headers: extra, data });

  test('the reset action: no nonce 401, no instance nonce 403, unknown action 404, keyword checked on the server (400)', async ({ request }) => {
    await patch(request, { meta_description: 'Changed by REST' });

    expect((await action(request, { keyword: 'RESET' }, {})).status()).toBe(401);
    const noInstance = await action(request, { keyword: 'RESET' }, { 'X-WP-Nonce': headers['X-WP-Nonce'] as string });
    expect(noInstance.status()).toBe(403);
    expect((await noInstance.json()).code).toBe('fyldo_bad_nonce');
    expect((await action(request, { keyword: 'RESET' }, headers, 'wipe')).status()).toBe(404);

    for (const keyword of [undefined, '', 'reset', 'RESET now']) {
      const refused = await action(request, keyword === undefined ? {} : { keyword });
      expect(refused.status(), `keyword ${JSON.stringify(keyword)}`).toBe(400);
      expect((await refused.json()).code).toBe('fyldo_confirmation');
    }
    const still = await request.get('/index.php?rest_route=/fyldo-acme-beta/v1/pages/fields', { headers });
    expect((await still.json()).values.meta_description).toBe('Changed by REST'); // nothing changed
  });

  test('the reset action with the keyword returns the defaults and a new revision, and forgets what was stored', async ({ request }) => {
    const changed = await patch(request, { meta_description: 'Changed by REST', per_page: 20 });
    const changedRevision = (await changed.json()).revision as string;

    const response = await action(request, { keyword: '  RESET ' }); // surrounding spaces are ignored
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.values.meta_description).toBe('Fyldo is a lightweight settings framework.');
    expect(body.values.per_page).toBe(10);
    expect(body.values.license_key).toBe('FYLDO-FREE');
    expect(body.revision).toBe(initialRevision); // the option is gone: the revision of an empty option
    expect(body.revision).not.toBe(changedRevision);

    const read = await request.get('/index.php?rest_route=/fyldo-acme-beta/v1/pages/fields', { headers });
    expect((await read.json()).values.per_page).toBe(10);
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

    // segmented control: the first option sits on the right; slider: the value is written in Persian numerals
    const firstSegment = await page.getByRole('radio', { name: 'By order' }).boundingBox();
    const lastSegment = await page.getByRole('radio', { name: 'Simple' }).boundingBox();
    expect(firstSegment!.x).toBeGreaterThan(lastSegment!.x);
    await expect(page.getByRole('slider', { name: 'Image quality' })).toHaveAttribute('aria-valuetext', '۷۵');

    // choice cards: the first card sits on the right, the last on the left
    const firstCard = await page.getByRole('radio', { name: 'Compact' }).boundingBox();
    const lastCard = await page.getByRole('radio', { name: 'Spacious' }).boundingBox();
    expect(firstCard!.x).toBeGreaterThan(lastCard!.x);

    // color picker: swatch at the start (right), chevron at the end (left); the hex value stays left to right
    const accent = page.getByRole('button', { name: 'Accent color' });
    await expect(accent.locator('bdi')).toHaveAttribute('dir', 'ltr');
    const swatch = await accent.locator('[data-slot=fy-color-dot]').boundingBox();
    const control = await accent.boundingBox();
    expect(swatch!.x + swatch!.width).toBeGreaterThan(control!.x + control!.width / 2);

    // icon picker: preview tile at the start (right), grid icon at the end (left); the icon name stays left to right
    const menuIcon = page.getByRole('button', { name: 'Menu icon' });
    await expect(menuIcon.locator('bdi')).toHaveAttribute('dir', 'ltr');
    const tile = await menuIcon.locator('[data-slot=fy-icon-preview]').boundingBox();
    const iconControl = await menuIcon.boundingBox();
    expect(tile!.x + tile!.width).toBeGreaterThan(iconControl!.x + iconControl!.width / 2);

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
  test('danger zone and notices: Persian strings, the keyword in the label, the modal mirrored, the toast bottom-left', async ({ page }) => {
    await page.goto(FA);
    await expect(page.getByText('این کار قابل بازگشت نیست.')).toBeVisible();
    await expect(page.locator('[data-slot=fy-notices]').getByRole('region').nth(1)).toHaveAccessibleName('اطلاعات: Update available');

    // the card's title and the action's label are the developer's strings (English in the fixture); Fyldo's own are Persian
    await page.getByRole('region', { name: 'Reset settings' }).getByRole('button', { name: 'Reset settings' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'همه‌ی تنظیمات بازنشانی شوند؟' });
    await expect(dialog).toBeVisible();
    const keyword = dialog.getByRole('textbox', { name: 'برای تأیید، «RESET» را تایپ کنید' });
    await expect(keyword).toBeFocused();
    await page.screenshot({ path: 'test-results/wp-danger-fa.png' });

    // Cancel at the start (right), Confirm at the end (left)
    const cancel = await dialog.getByRole('button', { name: 'انصراف' }).boundingBox();
    const confirm = await dialog.getByRole('button', { name: 'Reset settings' }).boundingBox();
    expect(cancel!.x).toBeGreaterThan(confirm!.x);

    await keyword.fill('RESET');
    await dialog.getByRole('button', { name: 'Reset settings' }).click();
    await expect(dialog).toHaveCount(0);
    const toast = page.locator('[data-fyldo-v1] [data-slot=fy-toast]');
    await expect(toast).toContainText('تنظیمات به مقدار پیش‌فرض بازنشانی شد');
    // bottom-end in RTL = bottom-left, 24px from the edges
    const box = await toast.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeCloseTo(24, 0);
    expect(viewport.height - (box!.y + box!.height)).toBeCloseTo(24, 0);
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

  test('input fields: URL and email text is LTR while the label stays RTL, Persian messages, Persian "set" placeholder', async ({ page }) => {
    await page.goto(FA);
    const url = page.getByRole('textbox', { name: 'Canonical URL' });
    await expect(url).toHaveAttribute('dir', 'ltr');
    expect(await url.evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
    expect(await page.getByText('Canonical URL', { exact: true }).evaluate((el) => getComputedStyle(el).direction)).toBe('rtl'); // the label keeps the page direction
    await expect(page.getByRole('textbox', { name: 'Contact email' })).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('textbox', { name: 'Items per page' })).toHaveAttribute('dir', 'ltr');
    // the LTR text sits at the inline END of the field in RTL (right), as the pack's Input usage frame draws it
    for (const name of ['Canonical URL', 'Contact email', 'Items per page']) {
      expect(await page.getByRole('textbox', { name }).evaluate((el) => getComputedStyle(el).textAlign), name).toBe('right');
    }

    // a Notice in Persian: the tone word is translated
    await expect(page.getByRole('region', { name: 'اطلاعات: Before you connect' })).toBeVisible();

    // digits
    const perPage = page.getByRole('textbox', { name: 'Items per page' });
    await perPage.fill('');
    await perPage.pressSequentially('۴۲');
    await expect(perPage).toHaveValue('42');
    // the Persian separators: ٬ (thousands) is dropped, ٫ (decimal) reads as a dot
    await perPage.fill('');
    await perPage.pressSequentially('۱٬۰۰۰٫۵');
    await expect(perPage).toHaveValue('1000.5');
    await perPage.fill('');
    await perPage.pressSequentially('۴۲');
    await page.getByRole('textbox', { name: 'Contact email' }).focus();
    await expect(page.getByText('مقدار را با گام 5 وارد کنید.')).toBeVisible();

    await perPage.fill('abc');
    await page.getByRole('textbox', { name: 'Contact email' }).focus();
    await expect(page.getByText('یک عدد وارد کنید.')).toBeVisible();
    await page.screenshot({ path: 'test-results/wp-input-fields-fa.png' });
  });
});
