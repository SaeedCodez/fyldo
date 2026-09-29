import { expect, test, type APIRequestContext } from '@playwright/test';
import { readConfig, resetData, settingsUrl } from './helpers';

const post = (request: APIRequestContext, ns: string, headers: Record<string, string>, data: unknown) =>
  request.post(`/index.php?rest_route=/${ns}/pages/general`, { headers: { 'X-HTTP-Method-Override': 'PATCH', ...headers }, data });

test.describe('REST security and validation', () => {
  let wpNonce = '';
  let instanceNonce = '';
  let revision = '';

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await context.newPage();
    await resetData(context.request);
    await page.goto(settingsUrl('acme-beta'));
    const config = await readConfig(page, 'acme-beta');
    wpNonce = config.rest.nonce;
    instanceNonce = config.rest.instanceNonce;
    revision = config.pages[0].revision;
    await context.close();
  });

  const ns = 'fyldo-acme-beta/v1';

  test('no nonce at all: 401 (core treats the cookie session as logged out)', async ({ request }) => {
    const response = await post(request, ns, {}, { values: { site_title: 'x' } });
    expect(response.status()).toBe(401);
  });

  test('core nonce but no instance nonce: 403 fyldo_bad_nonce', async ({ request }) => {
    const response = await post(request, ns, { 'X-WP-Nonce': wpNonce }, { values: { site_title: 'x' } });
    expect(response.status()).toBe(403);
    expect((await response.json()).code).toBe('fyldo_bad_nonce');
  });

  test('another instance’s nonce does not open this instance', async ({ browser, request }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await context.newPage();
    await page.goto(settingsUrl('acme-alpha'));
    const alpha = await readConfig(page, 'acme-alpha');
    await context.close();

    const response = await post(request, ns, { 'X-WP-Nonce': wpNonce, 'X-Fyldo-Nonce': alpha.rest.instanceNonce }, { values: { site_title: 'x' } });
    expect(response.status()).toBe(403);
  });

  test('a valid save returns sanitized values and a fresh revision', async ({ request }) => {
    const response = await post(request, ns, { 'X-WP-Nonce': wpNonce, 'X-Fyldo-Nonce': instanceNonce }, { values: { site_title: '  <b>Rest</b> title ', unknown_field: 'dropped' }, revision });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.values.site_title).toBe('Rest title');
    expect(body.values).not.toHaveProperty('unknown_field');
    expect(body.revision).not.toBe(revision);
    revision = body.revision;
  });

  test('invalid values: 422 with per-field messages, nothing stored', async ({ request }) => {
    const headers = { 'X-WP-Nonce': wpNonce, 'X-Fyldo-Nonce': instanceNonce };
    const empty = await post(request, ns, headers, { values: { site_title: '' } });
    expect(empty.status()).toBe(422);
    expect((await empty.json()).data.errors).toEqual({ site_title: 'This field is required.' });

    const tooLong = await post(request, ns, headers, { values: { site_title: 'x'.repeat(61) } });
    expect(tooLong.status()).toBe(422);
    expect((await tooLong.json()).data.errors.site_title).toBe('Use no more than 60 characters.');

    const badOption = await post(request, ns, headers, { values: { language: 'xx_XX' } });
    expect(badOption.status()).toBe(422);
    expect((await badOption.json()).data.errors.language).toBe('Choose one of the available options.');

    const check = await request.get(`/index.php?rest_route=/${ns}/pages/general`, { headers: { 'X-WP-Nonce': wpNonce, 'X-Fyldo-Nonce': instanceNonce } });
    expect((await check.json()).values.site_title).toBe('Rest title');
  });

  test('a stale revision is a 409 conflict that carries the latest values', async ({ request }) => {
    const headers = { 'X-WP-Nonce': wpNonce, 'X-Fyldo-Nonce': instanceNonce };
    const stale = await post(request, ns, headers, { values: { site_title: 'Stale' }, revision: 'not-the-current-revision' });
    expect(stale.status()).toBe(409);
    const body = await stale.json();
    expect(body.code).toBe('fyldo_conflict');
    expect(body.data.values.site_title).toBe('Rest title');
  });

  test('unknown page: 404', async ({ request }) => {
    const response = await request.post(`/index.php?rest_route=/${ns}/pages/nope`, { headers: { 'X-WP-Nonce': wpNonce, 'X-Fyldo-Nonce': instanceNonce }, data: { values: {} } });
    expect(response.status()).toBe(404);
  });
});
