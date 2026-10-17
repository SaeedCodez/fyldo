import { __ } from '../i18n';
import type { FieldValue, FyldoConfig, MediaMap, RelationItem } from '../types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly errors: Record<string, string> = {},
    readonly data: { values?: Record<string, FieldValue>; revision?: string } = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface SaveResult {
  values: Record<string, FieldValue>;
  revision: string;
  /** The saved attachments of the page's media fields; absent when the page has none. */
  media?: MediaMap;
}

/** One page of a post, term or user field's options. */
export interface ItemsResult {
  items: RelationItem[];
  /** Another page follows. */
  more: boolean;
}

/** `include`: only these IDs (the titles of a value the page has none for); otherwise one page of `search` results. */
export interface ItemsQuery {
  search?: string;
  page?: number;
  include?: number[];
}

export interface Api {
  savePage(pageId: string, values: Record<string, FieldValue>, revision: string): Promise<SaveResult>;
  /** The stored values and revision right now (conflict recovery: "Reload latest values"). */
  readPage(pageId: string): Promise<SaveResult>;
  /**
   * A Danger Section Card's action (`POST …/pages/{page}/actions/{action}`): the typed keyword goes along, the server
   * checks it again. Resolves with the page's new values and revision.
   */
  runAction(pageId: string, actionId: string, keyword: string): Promise<SaveResult>;
  /**
   * Options of a post, term or user field (`GET …/pages/{page}/fields/{field}/items`); `fieldPath` is the field id, or
   * `<group>.<sub-field>` for one inside a group. Optional: a test double for a page without such fields leaves it out.
   */
  searchItems?(pageId: string, fieldPath: string, query: ItemsQuery, signal?: AbortSignal): Promise<ItemsResult>;
}

/** A stored record of a plugin's form (`…/forms/{form}/records/{key}`): its key ('' for a new one not saved yet). */
export interface RecordResult extends SaveResult {
  key: string;
}

/** The records of the plugin's forms, drawn by `<Form>`. */
export interface RecordsApi {
  /** `key` 'new': the defaults of a record not created yet (`key` and `revision` are ''). */
  readRecord(formId: string, key: string): Promise<RecordResult>;
  /** `key` 'new' creates the record: the result carries its new key. */
  saveRecord(formId: string, key: string, values: Record<string, FieldValue>, revision: string): Promise<RecordResult>;
  /** Options of a post, term or user field of the form, like `searchItems` for a page. */
  searchRecordItems(formId: string, fieldPath: string, query: ItemsQuery, signal?: AbortSignal): Promise<ItemsResult>;
}

/** A query string value: lists are sent comma-separated (WordPress reads them with `wp_parse_list`); null and undefined are left out. */
export type QueryValue = string | number | boolean | null | undefined | Array<string | number>;

export interface RequestOptions {
  /** Default GET. PUT, PATCH and DELETE are sent as POST + `X-HTTP-Method-Override`. */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Sent as the JSON body. */
  data?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

/**
 * A request to any REST route of the site, relative to its REST root (`request('acme/v1/items', { query: { status:
 * 'draft' } })`). Resolves with the parsed JSON (null when there is none); rejects with an `ApiError`.
 */
export type RequestFn = <T = unknown>(path: string, options?: RequestOptions) => Promise<T>;

export interface Client extends Api, RecordsApi {
  request: RequestFn;
}

/** The error codes of a nonce WordPress (`X-WP-Nonce`) or Fyldo (instance nonce) no longer accepts. */
const NONCE_CODES = ['rest_cookie_invalid_nonce', 'fyldo_bad_nonce'];

/** The user is no longer logged in (or the session behind the nonces is gone): log in again, then retry. */
export const LOGGED_OUT = 'fyldo_logged_out';
export const loggedOutMessage = (): string => __('Your login has expired. Log in again, then try again.', 'fyldo');

/** The site's REST root: `rest.base`, or (older configs) `rest.root` without its namespace (`fyldo-acme/v1/`). */
export const restBase = (rest: FyldoConfig['rest']): string => rest.base ?? rest.root.replace(/[^/?=]+\/[^/?=]+\/?$/, '');

/** `?a=1&b=2`, or `&a=1…` when the URL already has a query (`?rest_route=/…` on sites without pretty permalinks). */
function withQuery(url: string, query: Record<string, QueryValue> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const qs = params.toString();
  return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url;
}

/** The query of a relation field's options: `include` (the titles of IDs) or one page of `search` results. */
const itemsQuery = (query: ItemsQuery): Record<string, QueryValue> =>
  query.include?.length ? { include: query.include } : { search: query.search || undefined, paged: query.page && query.page > 1 ? query.page : undefined };

const itemsResult = (body: Body): ItemsResult => ({ items: Array.isArray(body.items) ? (body.items as RelationItem[]) : [], more: body.more === true });

/**
 * REST client for one instance. Every request to the instance's routes carries the core cookie nonce (`X-WP-Nonce`) and
 * the per-instance nonce; `request()` (a custom page's own routes) only the core one. PATCH is sent as POST +
 * `X-HTTP-Method-Override` because some hosts still block PATCH; WordPress accepts both.
 *
 * Both nonces expire (after a day, or with a new login). A request refused for its nonce asks `rest.refresh` (admin-ajax,
 * cookie-authenticated) for fresh ones and is sent once more; when there are none to have, the user is logged out
 * (`LOGGED_OUT`). Unsaved edits are never touched here: the caller keeps them.
 */
export function createApi(config: Pick<FyldoConfig, 'rest'>, fetchImpl: typeof fetch = (...a) => fetch(...a)): Client {
  const { root, nonceHeader, refresh } = config.rest;
  const base = restBase(config.rest);
  let { nonce, instanceNonce } = config.rest;
  // One refresh at a time: requests that fail together wait for the same answer.
  let refreshing: Promise<boolean> | null = null;

  const refreshNonces = (): Promise<boolean> => {
    refreshing ??= (async () => {
      try {
        const response = await fetchImpl(refresh, { credentials: 'same-origin', cache: 'no-store' });
        const body = (await response.json().catch(() => null)) as { success?: boolean; data?: { nonce?: unknown; instanceNonce?: unknown } } | null;
        if (!response.ok || body?.success !== true || typeof body.data?.nonce !== 'string' || typeof body.data.instanceNonce !== 'string') {
          return false;
        }
        nonce = body.data.nonce;
        instanceNonce = body.data.instanceNonce;
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  };

  /** `own`: a route of this instance, which also wants the instance nonce. */
  const send = async (url: string, init: RequestInit, own: boolean): Promise<Response> => {
    try {
      return await fetchImpl(url, {
        credentials: 'same-origin',
        ...init,
        headers: { 'X-WP-Nonce': nonce, ...(own ? { [nonceHeader]: instanceNonce } : {}), ...(init.headers as Record<string, string>) },
      });
    } catch (e) {
      // A request the caller stopped is not a network failure: let it see its own AbortError.
      if (init.signal?.aborted) throw e;
      throw new ApiError('network', 0, 'fyldo_network');
    }
  };

  /** The JSON of a request (undefined when there is none); refreshes the nonces once when they have expired. */
  const call = async (url: string, init: RequestInit, own = true): Promise<unknown> => {
    let response = await send(url, init, own);
    let json = await parse(response);

    if (response.status === 403 && NONCE_CODES.includes(String(asBody(json).code))) {
      if (!(refresh && (await refreshNonces()))) {
        throw new ApiError(loggedOutMessage(), 401, LOGGED_OUT);
      }
      response = await send(url, init, own);
      json = await parse(response);
    }

    const body = asBody(json);
    if (response.status === 401 || (response.status === 403 && NONCE_CODES.includes(String(body.code)))) {
      throw new ApiError(loggedOutMessage(), 401, LOGGED_OUT);
    }

    if (!response.ok) {
      throw new ApiError(String(body.message ?? response.statusText), response.status, String(body.code ?? 'error'), body.data?.errors ?? {}, {
        values: body.data?.values,
        revision: body.data?.revision,
      });
    }

    return json;
  };

  const page = (pageId: string, suffix = ''): string => `${root}pages/${encodeURIComponent(pageId)}${suffix}`;
  const form = (formId: string, suffix: string): string => `${root}forms/${encodeURIComponent(formId)}${suffix}`;

  const saved = (body: Body): SaveResult => ({
    values: body.values as Record<string, FieldValue>,
    revision: String(body.revision),
    ...(body.media ? { media: body.media as MediaMap } : {}),
  });
  const record = (body: Body): RecordResult => ({ key: String(body.key ?? ''), ...saved(body) });

  const patch = (values: Record<string, FieldValue>, revision: string): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-HTTP-Method-Override': 'PATCH' },
    body: JSON.stringify({ values, revision }),
  });
  const fresh: RequestInit = { method: 'GET', cache: 'no-store' };

  return {
    savePage: async (pageId, values, revision) => saved(asBody(await call(page(pageId), patch(values, revision)))),
    readPage: async (pageId) => saved(asBody(await call(page(pageId), fresh))),
    runAction: async (pageId, actionId, keyword) =>
      saved(
        asBody(
          await call(page(pageId, `/actions/${encodeURIComponent(actionId)}`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword }),
          }),
        ),
      ),
    searchItems: async (pageId, fieldPath, query, signal) =>
      itemsResult(asBody(await call(withQuery(page(pageId, `/fields/${encodeURIComponent(fieldPath)}/items`), itemsQuery(query)), { method: 'GET', signal }))),

    readRecord: async (formId, key) => record(asBody(await call(form(formId, `/records/${encodeURIComponent(key)}`), fresh))),
    saveRecord: async (formId, key, values, revision) => record(asBody(await call(form(formId, `/records/${encodeURIComponent(key)}`), patch(values, revision)))),
    searchRecordItems: async (formId, fieldPath, query, signal) =>
      itemsResult(asBody(await call(withQuery(form(formId, `/fields/${encodeURIComponent(fieldPath)}/items`), itemsQuery(query)), { method: 'GET', signal }))),

    request: async <T>(path: string, { method = 'GET', data, query, signal }: RequestOptions = {}): Promise<T> => {
      const verb = method.toUpperCase();
      const headers: Record<string, string> = {};
      if (verb !== 'GET' && verb !== 'POST') headers['X-HTTP-Method-Override'] = verb;
      const body = data === undefined || verb === 'GET' ? undefined : JSON.stringify(data);
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const url = withQuery(`${base}${path.replace(/^\/+/, '')}`, query);
      const json = await call(url, { method: verb === 'GET' ? 'GET' : 'POST', headers, body, signal }, false);
      return (json ?? null) as T;
    },
  };
}

type Body = Record<string, unknown> & {
  data?: { errors?: Record<string, string>; values?: Record<string, FieldValue>; revision?: string };
};

/** The JSON of a response; undefined for anything else (a PHP fatal's HTML page, an empty 502 from a proxy, a 204). */
const parse = async (response: Response): Promise<unknown> => response.json().catch(() => undefined);

/** A JSON object to read fields from; `{}` for anything else. */
const asBody = (json: unknown): Body => (json && typeof json === 'object' ? json : {}) as Body;
