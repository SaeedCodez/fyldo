/**
 * Custom pages and forms on a real WordPress (docs/custom-pages.md). Every fixture plugin registers a "Notes" custom page
 * (tests/fixtures/notes-page.php + notes-page.js): its module lists the notes through the plugin's own REST route
 * (`request`) and edits one with Fyldo's `Form`, whose records the plugin keeps in an option of its own. Covers the
 * route below the page (`#/notes/<id>`), the form round trip (defaults → server validation → create → key in the URL →
 * reload), and the unsaved-changes guard between two paths of the same page.
 */
import { expect, test, type Page } from '@playwright/test';
import { resetData, settingsUrl } from './helpers';

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

const NOTES = `${settingsUrl('acme-beta')}#/notes`;
const h1 = (page: Page) => page.getByRole('heading', { level: 1 });
const saveBar = (page: Page) => page.getByRole('region', { name: 'Unsaved changes' });

test('a custom page lists records from its own route and edits them with a Fyldo form', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(NOTES);
  await expect(h1(page)).toHaveText('Notes');
  await expect(page.getByRole('navigation', { name: 'Acme Beta' }).getByRole('link', { name: 'Notes' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('No notes yet')).toBeVisible();

  // A path below the page: the module's editor, a Fyldo form with the defaults of a new record.
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page).toHaveURL(/#\/notes\/new$/);
  await expect(h1(page)).toHaveText('New note');
  const title = page.getByRole('textbox', { name: 'Title' });
  await expect(title).toHaveValue('');

  // The server checks a new record whole: the untouched, required Title fails.
  await page.getByRole('switch', { name: 'Done' }).click();
  await saveBar(page).getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('This field is required.')).toBeVisible();

  await title.fill('Buy milk');
  await saveBar(page).getByRole('button', { name: 'Save changes' }).click();
  // The new key replaces `new` in the URL (no extra history entry) and the editor stays.
  await expect(page).toHaveURL(/#\/notes\/1$/);
  await expect(h1(page)).toHaveText('Edit note');

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Buy milk');
  await expect(page.getByRole('switch', { name: 'Done' })).toHaveAttribute('aria-checked', 'true');

  // Unsaved edits: going to another path of the same page asks first.
  await page.getByRole('textbox', { name: 'Title' }).fill('Buy oat milk');
  await page.getByRole('button', { name: 'All notes' }).click();
  const dialog = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
  await expect(dialog).toBeVisible();
  expect(page.url()).toMatch(/#\/notes\/1$/);
  await dialog.getByRole('button', { name: 'Discard' }).click();
  await expect(h1(page)).toHaveText('Notes');
  await expect(page.getByRole('link', { name: 'Buy milk' })).toBeVisible();

  // Back returns to the editor, with what is stored.
  await page.goBack();
  await expect(h1(page)).toHaveText('Edit note');
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Buy milk');

  expect(errors).toEqual([]);
});

test('a record that does not exist says so instead of an empty form', async ({ page }) => {
  await page.goto(`${NOTES}/99`);
  await expect(h1(page)).toHaveText('Edit note');
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveCount(0);
  await expect(page.getByText(/doesn.t exist|does not exist/)).toBeVisible();
});
