import { expect, test } from '@playwright/test';
import { settingsUrl, resetData } from './helpers';

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

const FA = settingsUrl('acme-beta', '&fyldo_locale=fa_IR');

test.describe('Persian (RTL)', () => {
  test('direction, language and font come from the request, not from a second component set', async ({ page }) => {
    await page.goto(FA);
    const root = page.locator('[data-fyldo-v1="acme-beta"]');
    await expect(root).toHaveAttribute('dir', 'rtl');
    await expect(root).toHaveAttribute('lang', 'fa-IR');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    const font = await root.getByRole('textbox', { name: 'Site title' }).evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font).toContain('Fyldo Vazirmatn');
    const h1 = await root.locator('h1').evaluate((el) => getComputedStyle(el).lineHeight);
    expect(h1).toBe('48px'); // Figma FA/Heading/32 line-height, letter-spacing 0
    expect(await root.locator('h1').evaluate((el) => getComputedStyle(el).letterSpacing)).toMatch(/^(0px|normal)$/);
  });

  test('Fyldo’s own UI strings are Persian (PHP .mo + bundled JED)', async ({ page }) => {
    await page.goto(FA);
    const title = page.getByRole('textbox', { name: 'Site title' });
    await title.fill('');
    await title.blur();
    await expect(page.getByText('این فیلد الزامی است.')).toBeVisible(); // client validation message

    await title.fill('عنوان');
    await expect(page.getByText('تغییرات ذخیره‌نشده دارید')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ذخیره‌ی تغییرات' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'لغو تغییرات' })).toBeVisible();
    await page.screenshot({ path: 'test-results/wp-fa.png' });

    await page.getByRole('button', { name: 'ذخیره‌ی تغییرات' }).click();
    await expect(page.getByText('همه‌ی تغییرات ذخیره شد')).toBeVisible();
  });

  test('geometry mirrors: switch thumb travels toward the start (left), the select icon sits at the right', async ({ page }) => {
    await page.goto(FA);
    const toggle = page.locator('[data-slot=fy-toggle]').nth(1); // "24-hour time" is on by default
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    const track = await toggle.boundingBox();
    const thumb = await toggle.locator('span').first().boundingBox();
    // RTL: "on" puts the thumb on the LEFT half of the track.
    expect(thumb!.x + thumb!.width / 2).toBeLessThan(track!.x + track!.width / 2);

    const trigger = page.getByRole('combobox', { name: 'Site language' });
    const box = await trigger.boundingBox();
    const icon = await trigger.locator('svg[data-fyldo-icon="global"]').boundingBox();
    expect(icon!.x + icon!.width / 2).toBeGreaterThan(box!.x + box!.width / 2); // prefix icon at the start = right
    const chevron = await trigger.locator('svg[data-fyldo-icon="arrowdown2"]').boundingBox();
    expect(chevron!.x + chevron!.width / 2).toBeLessThan(box!.x + box!.width / 2); // chevron at the end = left
  });

  test('URLs stay left-to-right even in an RTL layout', async ({ page }) => {
    await page.goto(FA);
    // The fixture has no url field; the Input `ltr` flag is unit-tested. Here: a text field stays RTL.
    const dir = await page.getByRole('textbox', { name: 'Site title' }).evaluate((el) => getComputedStyle(el).direction);
    expect(dir).toBe('rtl');
  });
});
