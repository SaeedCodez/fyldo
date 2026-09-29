import type { FieldValue, FyldoConfig } from '../types';

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
}

export interface Api {
  savePage(pageId: string, values: Record<string, FieldValue>, revision: string): Promise<SaveResult>;
}

/**
 * REST client for one instance. Every request carries the core cookie nonce (`X-WP-Nonce`) and the per-instance nonce.
 * PATCH is sent as POST + `X-HTTP-Method-Override` because some hosts still block PATCH; WordPress accepts both.
 */
export function createApi(config: Pick<FyldoConfig, 'rest'>, fetchImpl: typeof fetch = (...a) => fetch(...a)): Api {
  const { root, nonce, instanceNonce, nonceHeader } = config.rest;

  return {
    async savePage(pageId, values, revision) {
      let response: Response;
      try {
        response = await fetchImpl(`${root}pages/${encodeURIComponent(pageId)}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'X-HTTP-Method-Override': 'PATCH',
            'X-WP-Nonce': nonce,
            [nonceHeader]: instanceNonce,
          },
          body: JSON.stringify({ values, revision }),
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

      return { values: body.values as Record<string, FieldValue>, revision: String(body.revision) };
    },
  };
}
