/**
 * M5-lite — axe (WCAG 2.0/2.1/2.2 A + AA) on every gallery component and on the full settings page in both layouts
 * (Sidebar, Top Navigation), EN + FA. No allow-list: a violation fails the build (ARCHITECTURE §12).
 * The gallery renders one component per page, so page-level landmark rules do not apply there; they are best-practice
 * rules and are not in the WCAG tag set used here.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Transitions off, so a scan never catches a colour half-way through its 100 ms fade (also the reduced-motion path).
test.use({ reducedMotion: 'reduce' });

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function scan(page: Page, selector = '[data-fyldo-v1]') {
  const { violations } = await new AxeBuilder({ page }).include(selector).withTags(TAGS).analyze();
  const report = violations.map((v) => `${v.id}: ${v.help}\n${v.nodes.map((n) => `  ${n.target.join(' ')}\n  ${n.failureSummary}`).join('\n')}`);
  expect(report, report.join('\n\n')).toEqual([]);
}

const enc = (o: Record<string, string>) => new URLSearchParams(o).toString();

const CARD = JSON.stringify({
  title: 'Site identity',
  description: 'How your site introduces itself.',
  rows: [
    { title: 'Site title', description: 'Shown in the browser tab.', layout: 'stacked', value: 'Fyldo' },
    { title: 'Enable caching', description: 'Speeds up your site.', layout: 'inline', checked: true },
  ],
  footerText: 'Changes apply after saving.',
  action: 'Save changes',
});

interface Story {
  name: string;
  query: Record<string, string>;
  fa?: Record<string, string>;
}

const STORIES: Story[] = [
  { name: 'button', query: { c: 'button', variant: 'primary', size: 'md' } },
  { name: 'button error', query: { c: 'button', variant: 'error', size: 'md' } },
  { name: 'button secondary', query: { c: 'button', variant: 'secondary', size: 'md' } },
  { name: 'icon button', query: { c: 'icon-button', variant: 'tertiary', size: 'sm', icon: 'more', label: 'More options' } },
  { name: 'input', query: { c: 'input', size: 'md', state: 'default' } },
  { name: 'input error', query: { c: 'input', size: 'md', state: 'error' } },
  { name: 'input disabled', query: { c: 'input', size: 'md', state: 'disabled' } },
  { name: 'textarea', query: { c: 'textarea', state: 'default', label: 'Description', placeholder: 'Write here', count: '12', limit: '160' } },
  { name: 'textarea error', query: { c: 'textarea', state: 'error', label: 'Description', value: 'Too long', error: 'Shorten this text.' } },
  { name: 'toggle', query: { c: 'toggle', size: 'md', checked: '1' } },
  { name: 'checkbox', query: { c: 'checkbox', checked: '1', label: 'Enable caching' } },
  { name: 'checkbox indeterminate', query: { c: 'checkbox', checked: 'indeterminate', label: 'Some options' } },
  { name: 'radio', query: { c: 'radio', checked: '1', label: 'Public' } },
  { name: 'checkbox group', query: { c: 'checkbox-group', title: 'Post types', options: 'post:Posts|page:Pages|product:Products:Available in Pro.:disabled', value: 'post' } },
  { name: 'radio group', query: { c: 'radio-group', title: 'Visibility', options: 'pub:Public|priv:Private', value: 'pub' } },
  { name: 'select', query: { c: 'select', size: 'md', state: 'default' } },
  { name: 'select filled', query: { c: 'select', size: 'md', state: 'filled' } },
  { name: 'multi select', query: { c: 'multi-select', size: 'md', state: 'default', label: 'Post types', options: 'post:Posts|page:Pages', value: 'post' } },
  { name: 'multi select error', query: { c: 'multi-select', size: 'md', state: 'error', label: 'Post types', options: 'post:Posts|page:Pages', error: 'Pick at least one.' } },
  { name: 'tag', query: { c: 'tag', size: 'md', state: 'default', label: 'Posts', removable: '1' } },
  { name: 'badge', query: { c: 'badge', tone: 'gray', appearance: 'subtle', size: 'md', label: 'Badge' } },
  { name: 'badge solid success', query: { c: 'badge', tone: 'green', appearance: 'solid', size: 'md', label: 'Active' } },
  { name: 'badge solid info', query: { c: 'badge', tone: 'blue', appearance: 'solid', size: 'md', label: 'New' } },
  ...(['gray', 'blue', 'green', 'amber', 'red'] as const).map((tone) => ({
    name: `notice ${tone}`,
    query: { c: 'notice', tone, title: 'Heads up', message: 'Something needs your attention.' },
  })),
  { name: 'nav item', query: { c: 'nav-item', state: 'default', label: 'General', icon: 'setting-2', badge: '3' } },
  { name: 'nav item active', query: { c: 'nav-item', state: 'active', label: 'General', icon: 'setting-2' } },
  { name: 'tab', query: { c: 'tab', state: 'active', label: 'General', count: '3' } },
  { name: 'tabs', query: { c: 'tabs', tabs: 'Site identity|Reading|Permalinks|Privacy' } },
  { name: 'page header', query: { c: 'page-header', title: 'General', description: 'Basic site settings.', action: 'Documentation' } },
  { name: 'section card', query: { c: 'section-card', tone: 'default', spec: CARD } },
  { name: 'section card danger', query: { c: 'section-card', tone: 'danger', spec: CARD } },
  ...(['dirty', 'saving', 'saved', 'error'] as const).map((state) => ({ name: `save bar ${state}`, query: { c: 'save-bar', state } })),
  { name: 'modal', query: { c: 'modal', title: 'Discard unsaved changes?', description: 'Your edits will be lost.', cancel: 'Keep editing', confirm: 'Discard' } },
  { name: 'modal danger', query: { c: 'modal', type: 'danger', title: 'Reset all settings?', description: 'This cannot be undone.', cancel: 'Cancel', confirm: 'Reset settings', keyword: 'RESET' } },
  ...(['neutral', 'success', 'error', 'loading'] as const).map((tone) => ({ name: `toast ${tone}`, query: { c: 'toast', tone, title: 'Settings saved', description: 'All good.' } })),
  { name: 'empty state', query: { c: 'empty-state', size: 'lg', icon: 'element-plus', title: 'Nothing here yet', description: 'Add your first item.', primary: 'Add item', secondary: 'Learn more' } },
];

for (const locale of ['EN', 'FA'] as const) {
  const rtl = locale === 'FA';
  test.describe(`axe · gallery · ${locale}`, () => {
    for (const story of STORIES) {
      test(story.name, async ({ page }) => {
        await page.goto(`/e2e/.generated/gallery/index.html?${enc({ ...story.query, ...(rtl ? { dir: 'rtl' } : {}) })}`);
        await page.locator('#stage > *, [data-slot=fy-modal]').first().waitFor();
        await scan(page);
      });
    }
  });

  test.describe(`axe · settings page · ${locale}`, () => {
    for (const nav of ['sidebar', 'top'] as const) {
      for (const hash of ['general', 'fields', 'advanced/debug']) {
        test(`${nav} layout · #/${hash}`, async ({ page }) => {
          await page.goto(`/tests/harness/?${enc({ nav, ...(rtl ? { dir: 'rtl' } : {}) })}#/${hash}`);
          await page.getByRole('heading', { level: 1 }).waitFor();
          await scan(page);
        });
      }
    }

    test('dirty page: Save Bar and the unsaved-changes dialog', async ({ page }) => {
      await page.goto(`/tests/harness/?${enc(rtl ? { dir: 'rtl' } : {})}#/general`);
      await page.getByRole('textbox').first().fill('Changed');
      await page.getByRole('button', { name: /Save|ذخیره/ }).first().waitFor();
      await scan(page);
      await page.getByRole('navigation').getByRole('link').nth(1).click(); // leaving a dirty page asks first
      await page.getByRole('dialog').waitFor();
      await scan(page);
    });
  });
}

/**
 * One keyboard-only walkthrough (Sidebar layout, EN): skip link → navigation → tabs → a field → Save Bar → dialog.
 * The tabbed demo page saves per section, so its JSON is served with the global pattern to bring the Save Bar in.
 */
test('keyboard walkthrough: skip link → nav → tabs → field → Save Bar → dialog', async ({ page }) => {
  await page.route('**/tests/fixtures/tabs-page.client.json', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), save: 'global' } });
  });
  await page.goto('/tests/harness/#/general');
  await page.getByRole('heading', { level: 1, name: 'General' }).waitFor();

  const active = () => page.evaluate(() => document.activeElement?.getAttribute('data-slot') ?? document.activeElement?.tagName);
  /** Presses Tab (or Shift+Tab) until the locator has focus; the walkthrough never jumps focus with the mouse or `focus()`. */
  const tabTo = async (target: ReturnType<Page['locator']>, key = 'Tab', max = 40) => {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press(key);
      if (await target.evaluate((el) => el === document.activeElement)) return;
    }
    throw new Error(`Focus never reached the target with ${key} (${await active()})`);
  };

  // 1. The skip link is the first stop, shown only while focused; Enter lands on the page heading and keeps the route
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to page content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'General' })).toBeFocused();
  expect(new URL(page.url()).hash).toBe('#/general');

  // 2. Navigation: from the skip link the next stops are the nav links; Enter on "Advanced" opens that page (heading focused)
  await page.reload(); // focus starts at the top of the document again
  await page.getByRole('heading', { level: 1, name: 'General' }).waitFor();
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  const nav = page.getByRole('navigation', { name: 'Fyldo' });
  await page.keyboard.press('Tab');
  await expect(nav.getByRole('link').first()).toBeFocused();
  await tabTo(nav.getByRole('link', { name: 'Advanced' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Advanced' })).toBeFocused();

  // 3. Tabs: one tab stop for the list, arrows move between tabs, Enter activates
  await tabTo(page.getByRole('tab', { name: 'Cache' }));
  await expect(page.getByRole('tab', { name: 'Cache' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Debugging/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name: /Debugging/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toBeVisible();

  // 4. A field: Tab into the panel, Space flips the switch → the page is dirty and the Save Bar appears
  const toggle = page.getByRole('switch', { name: 'Write a debug log' });
  await tabTo(toggle);
  await page.keyboard.press('Space');
  await expect(page.getByText('You have unsaved changes')).toBeVisible();

  // 5. Save Bar: Discard, then Save changes, are reachable by Tab
  const saveBar = page.locator('[data-slot=fy-save-bar]');
  await tabTo(saveBar.getByRole('button', { name: 'Discard' }));
  await page.keyboard.press('Tab');
  await expect(saveBar.getByRole('button', { name: 'Save changes' })).toBeFocused();

  // 6. Dialog: leaving the dirty page by keyboard asks; focus starts on the safe choice, stays trapped, Esc cancels and
  //    returns focus to the link that opened it
  const general = nav.getByRole('link', { name: 'General' });
  await tabTo(general, 'Shift+Tab');
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
  await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    await expect.poll(() => dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true); // a focus guard may hold it for a tick
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(general).toBeFocused();
  expect(new URL(page.url()).hash).toBe('#/advanced/debug');
});
