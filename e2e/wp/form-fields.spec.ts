/**
 * Milestone 2 fields on a real WordPress: Textarea (counter), Checkbox, Checkbox group (parent), Radio group, Multi Select,
 * and the input fields: URL, email, password (write-only), number, notice, a disabled field with its reason, plus a
 * Segmented Control, a Slider, a Color Picker and an Icon Picker (their panel / modal are lazily loaded chunks), a date, a time
 * and a datetime (Calendar Panel and Time Panel, also lazily loaded), and the Upload Image
 * and Select File fields (the native media modal is stubbed; the attachments are real), and a Group (header buttons: reordered
 * with the keyboard, one added), a custom field (the demo's working-hours module: two selects, one stored value) and a post
 * field (pages found by searching the site, several picked; the pages are real).
 * The page is tests/fixtures/form-fields-page.php, registered by every demo plugin as page `fields` (route `#/fields`).
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readConfig, resetData, restNonce, settingsUrl } from './helpers';

const EN = `${settingsUrl('acme-beta')}#/fields`;
const FA = `${settingsUrl('acme-beta', '&fyldo_locale=fa_IR')}#/fields`;

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

// A 1×1 PNG and a tiny PDF: real attachments WordPress accepts, created through its own REST API.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 3 3]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

/** Uploads a file to the media library and returns what the library calls it. */
async function createAttachment(request: APIRequestContext, filename: string, mime: string, data: Buffer): Promise<{ id: number; name: string }> {
  const response = await request.post('/index.php?rest_route=/wp/v2/media', {
    headers: { 'X-WP-Nonce': await restNonce(request), 'Content-Disposition': `attachment; filename="${filename}"`, 'Content-Type': mime },
    data,
  });
  expect(response.ok(), await response.text()).toBe(true);
  const json = (await response.json()) as { id: number; source_url: string };
  return { id: json.id, name: decodeURIComponent(new URL(json.source_url).pathname.split('/').pop() ?? '') };
}

/** Publishes a page or post through WordPress's own REST API and returns its ID. */
async function createPost(request: APIRequestContext, type: 'pages' | 'posts', title: string): Promise<number> {
  const response = await request.post(`/index.php?rest_route=/wp/v2/${type}`, {
    headers: { 'X-WP-Nonce': await restNonce(request) },
    data: { title, status: 'publish' },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { id: number }).id;
}

/** A word no other page has, so a search finds only this test's pages. */
const uniqueWord = () => `Zq${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

/**
 * The real media modal is WordPress chrome and is not driven here: once the page has loaded (call it after `goto`, so WordPress's own
 * media scripts have finished with `wp.media.view`), `wp.media` is replaced by a stand-in whose frame "picks" the given attachment
 * for the field whose label is the frame's title. What it hands over is deliberately not
 * what the server knows (another file name), so the preview that comes back after saving can only be the server's.
 */
async function stubMediaModal(page: Page, picks: Record<string, number>): Promise<void> {
  await page.evaluate((byTitle) => {
    {
      const wp = ((window as unknown as { wp?: Record<string, unknown> }).wp ??= {});
      wp.media = Object.assign(
        (options: { title: string }) => {
          const handlers: Record<string, () => void> = {};
          const id = byTitle[options.title] as number;
          const attachment = {
            id,
            type: options.title === 'Site logo' ? 'image' : 'application',
            mime: options.title === 'Site logo' ? 'image/png' : 'application/pdf',
            filename: options.title === 'Site logo' ? 'picked-in-modal.png' : 'picked-in-modal.pdf',
            filesizeInBytes: 1024,
            width: 1,
            height: 1,
          };
          return {
            on: (event: string, callback: () => void) => void (handlers[event] = callback),
            state: () => ({ get: () => ({ reset: () => undefined, add: () => undefined, first: () => ({ toJSON: () => attachment }) }) }),
            open: () => {
              handlers.open?.();
              handlers.select?.();
              handlers.close?.();
            },
          };
        },
        { attachment: (id: number) => ({ id, fetch: () => undefined, toJSON: () => ({ id }) }) },
      );
    }
  }, picks);
}

const save = (page: Page) => page.getByRole('button', { name: /Save changes|ذخیره‌ی تغییرات/ }).click();

test.describe('English', () => {
  test('renders the defaults, edits every control, saves through REST and persists', async ({ page, request }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const logo = await createAttachment(request, 'logo-mark.png', 'image/png', PNG);
    const guide = await createAttachment(request, 'brand-guidelines.pdf', 'application/pdf', PDF);

    await page.goto(EN);
    await expect(page.getByRole('heading', { level: 1, name: 'Content' })).toBeVisible();
    await stubMediaModal(page, { 'Site logo': logo.id, 'Brand guidelines': guide.id });

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
    // `includeHidden`: the page behind the open modal is aria-hidden
    const menuIcon = page.getByRole('button', { name: 'Menu icon', includeHidden: true });
    await expect(menuIcon).toHaveText('home-2');
    await menuIcon.click();
    await page.getByRole('option', { name: 'star' }).click(); // a tile of the lazily loaded modal (the field offers 4 icons)
    await expect(menuIcon).toHaveText('home-2'); // nothing changes until "Select icon"
    await page.getByRole('button', { name: 'Select icon' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(menuIcon).toBeFocused();
    await expect(menuIcon).toHaveText('star');

    // Date, time and datetime (their panels are a lazily loaded chunk): a day picked with the keyboard, a typed time, and a
    // moment picked through the Years and Months views (the site's time zone is UTC, so it is stored as picked)
    const start = page.getByRole('button', { name: 'Start date' });
    await expect(start).toHaveText('Oct 20, 2026');
    await expect(page.getByText('28 Mehr 1405 · Jalali')).toBeVisible();
    await start.click();
    const calendar = page.getByRole('dialog', { name: 'Choose a date' });
    await expect(calendar.getByRole('gridcell', { name: 'Tuesday, Oct 20, 2026' })).toBeFocused();
    await expect(calendar.getByRole('radiogroup', { name: 'Calendar' })).toHaveCount(0); // locked to Gregorian
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(calendar).toBeHidden();
    await expect(start).toBeFocused();
    await expect(start).toHaveText('Oct 21, 2026');
    const report = page.getByRole('textbox', { name: 'Send the report at' });
    await expect(report).toHaveValue('09:00');
    await report.fill('1745');
    await report.blur();
    await expect(report).toHaveValue('17:45');
    const publish = page.getByRole('button', { name: 'Publish at' });
    await expect(publish).toHaveText('Pick a date and time…');
    await publish.click();
    const picker = page.getByRole('dialog', { name: 'Choose a date and time' });
    await expect(picker.getByRole('radiogroup', { name: 'Calendar' })).toBeVisible(); // `auto`: the switch
    await picker.locator('[data-calendar-title]').click(); // Months
    await picker.locator('[data-calendar-title]').click(); // Years
    await picker.getByRole('gridcell', { name: '2026', exact: true }).click();
    await picker.getByRole('gridcell', { name: 'November' }).click();
    await picker.getByRole('gridcell', { name: 'Tuesday, Nov 3, 2026' }).click();
    await picker.getByRole('listbox', { name: 'Hour' }).getByRole('option', { name: '08' }).click();
    await picker.getByRole('listbox', { name: 'Minute' }).getByRole('option', { name: '05' }).click();
    await page.keyboard.press('Escape');
    await expect(picker).toBeHidden();
    await expect(publish).toHaveText('Nov 3, 2026, 08:05');

    // Upload Image and Select File: empty, then "Select …" takes what the (stubbed) media modal hands over
    const logoField = page.getByRole('group', { name: 'Site logo' });
    const guideField = page.getByRole('group', { name: 'Brand guidelines' });
    await expect(logoField).toContainText('No image selected');
    await expect(guideField).toContainText('No file selected');
    await logoField.getByRole('button', { name: 'Select image: Site logo' }).click();
    await expect(logoField).toContainText('picked-in-modal.png');
    await expect(logoField.getByRole('button', { name: 'Replace: Site logo' })).toBeFocused();
    await guideField.getByRole('button', { name: 'Select file: Brand guidelines' }).click();
    await expect(guideField).toContainText('picked-in-modal.pdf');

    // Group (header buttons): move "Docs" down with the keyboard, then add a button with a label and a link
    const buttons = page.getByRole('group', { name: 'Header buttons' });
    const buttonTitles = buttons.locator('[data-slot=fy-group-item-title]');
    await expect(buttonTitles).toHaveText(['Docs', 'Get started']);
    await buttons.getByRole('button', { name: 'Reorder Docs' }).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await expect(buttonTitles).toHaveText(['Get started', 'Docs']);
    await buttons.getByRole('button', { name: 'Add button' }).click();
    await expect(buttons.getByRole('textbox', { name: 'Label' })).toBeFocused();
    await page.keyboard.type('Blog');
    await buttons.getByRole('textbox', { name: 'Link' }).fill('https://example.com/blog');
    await expect(buttonTitles).toHaveText(['Get started', 'Docs', 'Blog']);

    // Custom field: the demo's own module (loaded from the plugin folder) draws two selects saved as one value
    await expect(page.locator('link[href*="working-hours.css"]')).toHaveCount(1); // its `style`, enqueued by PHP
    const hours = page.getByRole('group', { name: 'Opening hours' });
    await expect(hours.getByRole('combobox', { name: 'Opens' })).toHaveText('09:00');
    await hours.getByRole('combobox', { name: 'Closes' }).click();
    await page.getByRole('option', { name: '18:00' }).click();
    await expect(hours.getByRole('combobox', { name: 'Closes' })).toHaveText('18:00');
    await expect(page.getByText('You have unsaved changes')).toBeVisible();
    await page.screenshot({ path: 'test-results/wp-fields-en.png' });

    await save(page);
    await expect(page.getByText('All changes saved')).toBeVisible();
    // the save response carries the attachment as the server knows it: no extra request, the preview is already the real one
    await expect(logoField).toContainText(logo.name);
    await expect(logoField).toContainText(/1 × 1 · \d+ B/);
    await expect(guideField).toContainText(guide.name);
    await expect(guideField).toContainText(/PDF · \d+ B/);

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
    await expect(page.getByRole('button', { name: 'Start date' })).toHaveText('Oct 21, 2026');
    await expect(page.getByRole('textbox', { name: 'Send the report at' })).toHaveValue('17:45');
    await expect(page.getByRole('button', { name: 'Publish at' })).toHaveText('Nov 3, 2026, 08:05');
    expect((await readConfig(page, 'acme-beta')).pages.find((p: { id: string }) => p.id === 'fields').values).toMatchObject({
      start_date: '2026-10-21',
      report_at: '17:45',
      publish_at: '2026-11-03 08:05:00',
    });
    await expect(page.getByRole('group', { name: 'Header buttons' }).locator('[data-slot=fy-group-item-title]')).toHaveText(['Get started', 'Docs', 'Blog']);
    await expect(page.getByRole('group', { name: 'Opening hours' }).getByRole('combobox', { name: 'Opens' })).toHaveText('09:00');
    await expect(page.getByRole('group', { name: 'Opening hours' }).getByRole('combobox', { name: 'Closes' })).toHaveText('18:00');
    // after a reload the preview comes from the server's initial payload
    await expect(page.getByRole('group', { name: 'Site logo' })).toContainText(logo.name);
    await expect(page.getByRole('group', { name: 'Site logo' })).toContainText(/1 × 1 · \d+ B/);
    await expect(page.getByRole('group', { name: 'Brand guidelines' })).toContainText(guide.name);
    await expect(page.getByRole('group', { name: 'Site logo' }).getByRole('button', { name: 'Replace: Site logo' })).toBeVisible();

    // Remove only clears the value: after saving, the field is empty and the file is still in the media library
    await page.getByRole('button', { name: 'Remove Site logo' }).click();
    await expect(page.getByRole('group', { name: 'Site logo' })).toContainText('No image selected');
    await save(page);
    await expect(page.getByText('All changes saved')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('group', { name: 'Site logo' })).toContainText('No image selected');
    await expect(page.getByRole('group', { name: 'Brand guidelines' })).toContainText(guide.name);
    expect((await request.get(`/index.php?rest_route=/wp/v2/media/${logo.id}`)).ok()).toBe(true);
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

  test('Post field: search the site’s pages, pick two, save through REST; the titles come back after a reload', async ({ page, request }) => {
    const word = uniqueWord();
    await createPost(request, 'pages', `${word} About`);
    await createPost(request, 'pages', `${word} Contact`);
    await createPost(request, 'posts', `${word} News`); // a post, not a page: never offered
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(EN);

    const field = page.getByRole('combobox', { name: 'Related pages' });
    await expect(field).toContainText('Select pages…');
    await field.click();
    const popup = page.getByRole('dialog');
    const search = popup.getByRole('combobox', { name: 'Search options' });
    await expect(search).toBeFocused();
    await search.fill(word);
    await expect(popup.getByRole('option')).toHaveCount(2);
    await popup.getByRole('option', { name: `${word} Contact` }).click();
    await popup.getByRole('option', { name: `${word} About` }).click();
    await expect(popup.getByText('2 selected')).toBeVisible();
    await page.screenshot({ path: 'test-results/wp-post-field-en-open.png' });
    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();
    await expect(field).toContainText(`${word} Contact${word} About`); // pick order

    await save(page);
    await expect(page.getByText('All changes saved')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Related pages' })).toContainText(`${word} Contact${word} About`);
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
    const viewport = page.viewportSize() as { width: number; height: number };
    await page.mouse.click(viewport.width - 40, 400); // on the scrim, away from the admin menu and the content scrollbar
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
  test('post: only published pages are kept, in pick order, with their titles; `max` counts them; the items route searches', async ({ request }) => {
    const word = uniqueWord();
    const [one, two, three, four] = [await createPost(request, 'pages', `${word} One`), await createPost(request, 'pages', `${word} Two`), await createPost(request, 'pages', `${word} Three`), await createPost(request, 'pages', `${word} Four`)];
    const post = await createPost(request, 'posts', `${word} Post`);

    let response = await patch(request, { related_pages: [one, two, three, four] });
    expect(response.status()).toBe(422);
    expect((await response.json()).data.errors.related_pages).toBe('Select no more than 3 options.');

    // a post (not a page), an ID that does not exist and a repeat drop out; the rest keep their order
    response = await patch(request, { related_pages: [two, post, 999999, one, two] });
    expect(response.status()).toBe(200);
    const saved = await response.json();
    expect(saved.values.related_pages).toEqual([two, one]);
    expect(saved.media.related_pages).toEqual([
      { value: two, label: `${word} Two`, hint: '' },
      { value: one, label: `${word} One`, hint: '' },
    ]);

    const items = (query: string) => request.get(`/index.php?rest_route=/fyldo-acme-beta/v1/pages/fields/fields/related_pages/items&${query}`, { headers });
    let found = await items(`search=${word}`);
    expect(found.ok(), await found.text()).toBe(true);
    expect(((await found.json()).items as { label: string }[]).map((i) => i.label).sort()).toEqual([`${word} Four`, `${word} One`, `${word} Three`, `${word} Two`]);
    found = await items(`include=${three},${post}`);
    expect((await found.json()).items).toEqual([{ value: three, label: `${word} Three`, hint: '' }]);
    expect((await items('search=x').then((r) => r.status()))).toBe(200);
    expect((await request.get('/index.php?rest_route=/fyldo-acme-beta/v1/pages/fields/fields/sitemap_types/items', { headers })).status()).toBe(404);
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

  test('date, time and datetime: only Gregorian stored formats, real days, 00:00–23:59 and the minute step are stored', async ({ request }) => {
    let response = await patch(request, { start_date: '2026-02-30', report_at: '24:00', publish_at: '2026-10-20T11:00:00Z' });
    expect(response.status()).toBe(422);
    expect((await response.json()).data.errors).toEqual({
      start_date: 'Enter a valid date.',
      report_at: 'Enter a valid time between 00:00 and 23:59.',
      publish_at: 'Enter a valid date and time.',
    });

    response = await patch(request, { start_date: '2025-02-29', report_at: '09:10', publish_at: '2026-10-20 11:02:00' });
    expect((await response.json()).data.errors).toEqual({
      start_date: 'Enter a valid date.',
      report_at: 'Choose a time in steps of 15 minutes.',
      publish_at: 'Choose a time in steps of 5 minutes.',
    });

    response = await patch(request, { start_date: '۲۰۲۴-۰۲-۲۹', report_at: '17:45', publish_at: '2026-11-03 08:05:00' });
    expect(response.status()).toBe(200);
    expect((await response.json()).values).toMatchObject({ start_date: '2024-02-29', report_at: '17:45', publish_at: '2026-11-03 08:05:00' });
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
    expect(parent!.x + parent!.width - (child!.x + child!.width)).toBeCloseTo(28, 0); // 28px indent (20px box + 8px gap) from the right edge

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
