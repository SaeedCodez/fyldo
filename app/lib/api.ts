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

/**
 * REST client for one instance. Every request carries the core cookie nonce (`X-WP-Nonce`) and the per-instance nonce.
 * PATCH is sent as POST + `X-HTTP-Method-Override` because some hosts still block PATCH; WordPress accepts both.
 */
export function createApi(config: Pick<FyldoConfig, 'rest'>, fetchImpl: typeof fetch = (...a) => fetch(...a)): Api {
  const { root, nonce, instanceNonce, nonceHeader } = config.rest;

  const request = async (pageId: string, init: RequestInit, suffix = ''): Promise<SaveResult> => {
    let response: Response;
    try {
      response = await fetchImpl(`${root}pages/${encodeURIComponent(pageId)}${suffix}`, {
        credentials: 'same-origin',
        ...init,
        headers: { 'X-WP-Nonce': nonce, [nonceHeader]: instanceNonce, ...(init.headers as Record<string, string>) },
      });
    } catch {
      throw new ApiError('network', 0, 'fyldo_network');
    }

    const body = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
      data?: { errors?: Record<string, string>; values?: Record<string, FieldValue>; revision?: string };
    };

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
