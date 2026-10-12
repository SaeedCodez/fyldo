import { __ } from '../i18n';
import type { FieldValue, FyldoConfig, MediaMap } from '../types';

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

export interface Api {
  savePage(pageId: string, values: Record<string, FieldValue>, revision: string): Promise<SaveResult>;
  /** The stored values and revision right now (conflict recovery: "Reload latest values"). */
  readPage(pageId: string): Promise<SaveResult>;
  /**
   * A Danger Section Card's action (`POST …/pages/{page}/actions/{action}`): the typed keyword goes along, the server
   * checks it again. Resolves with the page's new values and revision.
   */
  runAction(pageId: string, actionId: string, keyword: string): Promise<SaveResult>;
}

/** The error codes of a nonce WordPress (`X-WP-Nonce`) or Fyldo (instance nonce) no longer accepts. */
const NONCE_CODES = ['rest_cookie_invalid_nonce', 'fyldo_bad_nonce'];

/** The user is no longer logged in (or the session behind the nonces is gone): log in again, then retry. */
export const LOGGED_OUT = 'fyldo_logged_out';
export const loggedOutMessage = (): string => __('Your login has expired. Log in again, then try again.', 'fyldo');

/**
 * REST client for one instance. Every request carries the core cookie nonce (`X-WP-Nonce`) and the per-instance nonce.
 * PATCH is sent as POST + `X-HTTP-Method-Override` because some hosts still block PATCH; WordPress accepts both.
 *
 * Both nonces expire (after a day, or with a new login). A request refused for its nonce asks `rest.refresh` (admin-ajax,
 * cookie-authenticated) for fresh ones and is sent once more; when there are none to have, the user is logged out
 * (`LOGGED_OUT`). Unsaved edits are never touched here: the caller keeps them.
 */
export function createApi(config: Pick<FyldoConfig, 'rest'>, fetchImpl: typeof fetch = (...a) => fetch(...a)): Api {
  const { root, nonceHeader, refresh } = config.rest;
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

  const send = async (url: string, init: RequestInit): Promise<Response> => {
    try {
      return await fetchImpl(url, {
        credentials: 'same-origin',
        ...init,
        headers: { 'X-WP-Nonce': nonce, [nonceHeader]: instanceNonce, ...(init.headers as Record<string, string>) },
      });
    } catch {
      throw new ApiError('network', 0, 'fyldo_network');
    }
  };

  const request = async (pageId: string, init: RequestInit, suffix = ''): Promise<SaveResult> => {
    const url = `${root}pages/${encodeURIComponent(pageId)}${suffix}`;
    let response = await send(url, init);
    let body = await read(response);

    if (response.status === 403 && NONCE_CODES.includes(String(body.code))) {
      if (!(refresh && (await refreshNonces()))) {
        throw new ApiError(loggedOutMessage(), 401, LOGGED_OUT);
      }
      response = await send(url, init);
      body = await read(response);
    }

    if (response.status === 401 || (response.status === 403 && NONCE_CODES.includes(String(body.code)))) {
      throw new ApiError(loggedOutMessage(), 401, LOGGED_OUT);
    }

    if (!response.ok) {
      throw new ApiError(String(body.message ?? response.statusText), response.status, String(body.code ?? 'error'), body.data?.errors ?? {}, {
        values: body.data?.values,
        revision: body.data?.revision,
      });
    }

    return { values: body.values as Record<string, FieldValue>, revision: String(body.revision), ...(body.media ? { media: body.media as MediaMap } : {}) };
  };

  return {
    savePage: (pageId, values, revision) =>
      request(pageId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-HTTP-Method-Override': 'PATCH' },
        body: JSON.stringify({ values, revision }),
      }),
    readPage: (pageId) => request(pageId, { method: 'GET', cache: 'no-store' }),
    runAction: (pageId, actionId, keyword) =>
      request(pageId, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword }) }, `/actions/${encodeURIComponent(actionId)}`),
  };
}

type Body = Record<string, unknown> & {
  data?: { errors?: Record<string, string>; values?: Record<string, FieldValue>; revision?: string };
};

/** The JSON body, or `{}` for anything else (a PHP fatal's HTML page, an empty 502 from a proxy). */
const read = async (response: Response): Promise<Body> => ((await response.json().catch(() => ({}))) ?? {}) as Body;
