import { describe, expect, it, vi } from 'vitest';
import { ApiError, LOGGED_OUT, createApi } from '../../app/lib/api';

const config = { rest: { root: 'https://site.test/wp-json/fyldo-acme/v1/', nonce: 'WP', instanceNonce: 'INST', nonceHeader: 'X-Fyldo-Nonce', refresh: '/wp-admin/admin-ajax.php?action=fyldo_acme_nonces' } };
const respond = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

describe('REST client', () => {
  it('sends both nonces, the method override and only what it is given', async () => {
    const fetchMock = respond(200, { values: { title: 'B' }, revision: 'r2' });
    const result = await createApi(config, fetchMock as never).savePage('general', { title: 'B' }, 'r1');

    expect(result).toEqual({ values: { title: 'B' }, revision: 'r2' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://site.test/wp-json/fyldo-acme/v1/pages/general');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect(init.headers).toMatchObject({ 'X-WP-Nonce': 'WP', 'X-Fyldo-Nonce': 'INST', 'X-HTTP-Method-Override': 'PATCH', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ values: { title: 'B' }, revision: 'r1' });
  });

  it('maps 422 to per-field errors', async () => {
    const api = createApi(config, respond(422, { code: 'fyldo_invalid', message: 'Some values are not valid.', data: { status: 422, errors: { title: 'This field is required.' } } }) as never);
    await expect(api.savePage('general', {}, 'r')).rejects.toMatchObject({ status: 422, code: 'fyldo_invalid', errors: { title: 'This field is required.' } });
  });

  it('carries the latest values on a 409 conflict', async () => {
    const api = createApi(config, respond(409, { code: 'fyldo_conflict', message: 'changed', data: { status: 409, values: { title: 'theirs' }, revision: 'r9' } }) as never);
    const error = (await api.savePage('general', {}, 'r').catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.data).toEqual({ values: { title: 'theirs' }, revision: 'r9' });
  });

  it('turns a network failure into a status-0 error, and survives a non-JSON error page', async () => {
    const offline = createApi(config, (async () => {
      throw new TypeError('Failed to fetch');
    }) as never);
    await expect(offline.savePage('g', {}, 'r')).rejects.toMatchObject({ status: 0, code: 'fyldo_network' });

    const html = createApi(config, (async () => new Response('<html>502</html>', { status: 502 })) as never);
    await expect(html.savePage('g', {}, 'r')).rejects.toMatchObject({ status: 502 });
  });
});

describe('REST client: reading a page', () => {
  it('GETs the page with both nonces and returns its values and revision', async () => {
    const fetchMock = respond(200, { values: { title: 'theirs' }, revision: 'r9' });
    const result = await createApi(config, fetchMock as never).readPage('general');

    expect(result).toEqual({ values: { title: 'theirs' }, revision: 'r9' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://site.test/wp-json/fyldo-acme/v1/pages/general');
    expect(init.method).toBe('GET');
    expect(init.cache).toBe('no-store');
    expect(init.headers).toMatchObject({ 'X-WP-Nonce': 'WP', 'X-Fyldo-Nonce': 'INST' });
    expect(init.body).toBeUndefined();
  });
});

describe('REST client: expired nonces', () => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const badNonce = (code = 'rest_cookie_invalid_nonce') => json(403, { code, message: 'Cookie check failed', data: { status: 403 } });
  const fresh = () => json(200, { success: true, data: { nonce: 'WP2', instanceNonce: 'INST2' } });
  const saved = () => json(200, { values: { title: 'B' }, revision: 'r2' });
  const headersOf = (call: [string, RequestInit]) => call[1].headers as Record<string, string>;

  it.each(['rest_cookie_invalid_nonce', 'fyldo_bad_nonce'])('refreshes both nonces after %s and sends the request once more', async (code) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(badNonce(code)).mockResolvedValueOnce(fresh()).mockResolvedValueOnce(saved());
    const api = createApi(config, fetchMock as never);

    await expect(api.savePage('general', { title: 'B' }, 'r1')).resolves.toEqual({ values: { title: 'B' }, revision: 'r2' });
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls[1]?.[0]).toBe(config.rest.refresh);
    expect(calls[1]?.[1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store' });
    expect(headersOf(calls[2] as [string, RequestInit])).toMatchObject({ 'X-WP-Nonce': 'WP2', 'X-Fyldo-Nonce': 'INST2' });
    expect(JSON.parse(calls[2]?.[1].body as string)).toEqual({ values: { title: 'B' }, revision: 'r1' });

    // The fresh nonces are kept for the next request.
    fetchMock.mockResolvedValueOnce(saved());
    await api.readPage('general');
    expect(headersOf(calls[3] as [string, RequestInit])).toMatchObject({ 'X-WP-Nonce': 'WP2', 'X-Fyldo-Nonce': 'INST2' });
  });

  it('says the user is logged out when there are no fresh nonces to have', async () => {
    // admin-ajax answers a logged-out request with "0" (400).
    const fetchMock = vi.fn().mockResolvedValueOnce(badNonce()).mockResolvedValueOnce(new Response('0', { status: 400 }));
    const error = (await createApi(config, fetchMock as never).savePage('g', {}, 'r').catch((e) => e)) as ApiError;

    expect(error).toMatchObject({ status: 401, code: LOGGED_OUT, message: 'Your login has expired. Log in again, then try again.' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries only once, and maps a 401 to logged out', async () => {
    const twice = vi.fn().mockResolvedValueOnce(badNonce()).mockResolvedValueOnce(fresh()).mockResolvedValueOnce(badNonce('fyldo_bad_nonce'));
    await expect(createApi(config, twice as never).savePage('g', {}, 'r')).rejects.toMatchObject({ code: LOGGED_OUT });
    expect(twice).toHaveBeenCalledTimes(3);

    const unauthenticated = vi.fn().mockResolvedValueOnce(json(401, { code: 'fyldo_unauthenticated', message: 'You must be logged in.' }));
    await expect(createApi(config, unauthenticated as never).readPage('g')).rejects.toMatchObject({ status: 401, code: LOGGED_OUT });
  });

  it('asks for fresh nonces once when several requests fail together', async () => {
    let refreshes = 0;
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url === config.rest.refresh) {
        refreshes += 1;
        return fresh();
      }
      return (init.headers as Record<string, string>)['X-WP-Nonce'] === 'WP2' ? saved() : badNonce();
    });
    const api = createApi(config, fetchMock as never);

    await Promise.all([api.savePage('a', {}, 'r'), api.readPage('b')]);
    expect(refreshes).toBe(1);
  });

  it('does not touch the nonces for any other 403', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(403, { code: 'fyldo_forbidden', message: 'You are not allowed to change these settings.' }));
    await expect(createApi(config, fetchMock as never).savePage('g', {}, 'r')).rejects.toMatchObject({ status: 403, code: 'fyldo_forbidden' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
