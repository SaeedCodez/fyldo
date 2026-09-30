import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApi } from '../../app/lib/api';

const config = { rest: { root: 'https://site.test/wp-json/fyldo-acme/v1/', nonce: 'WP', instanceNonce: 'INST', nonceHeader: 'X-Fyldo-Nonce' } };
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
