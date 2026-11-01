import { execFileSync } from 'node:child_process';
import type { APIRequestContext, Page } from '@playwright/test';

export const settingsUrl = (slug: string, extra = ''): string => `/wp-admin/options-general.php?page=${slug}${extra}`;

export interface DemoInfo {
  slug: string;
  /** Root attribute name (per major). */
  attribute: 'data-fyldo-v1' | 'data-fyldo-v2';
  restNamespace: string;
  /** Directory name of the copy this demo bundles, for winner assertions. */
  dir: string;
}

export const DEMOS: DemoInfo[] = [
  { slug: 'acme-alpha', attribute: 'data-fyldo-v1', restNamespace: 'fyldo-acme-alpha/v1', dir: 'acme-alpha' },
  { slug: 'acme-beta', attribute: 'data-fyldo-v1', restNamespace: 'fyldo-acme-beta/v1', dir: 'acme-beta' },
  { slug: 'acme-gamma', attribute: 'data-fyldo-v1', restNamespace: 'fyldo-acme-gamma/v1', dir: 'acme-gamma' },
  { slug: 'acme-delta', attribute: 'data-fyldo-v2', restNamespace: 'fyldo-acme-delta/v2', dir: 'acme-delta' },
  { slug: 'acme-omega', attribute: 'data-fyldo-v1', restNamespace: 'fyldo-acme-omega/v1', dir: 'acme-omega' },
];

/** The config PHP inlined for an instance. The app deletes the window property, but the inline <script> remains. */
export async function readConfig(page: Page, slug: string): Promise<Record<string, any>> {
  const variable = `__fyldo_${slug.replace(/-/g, '_')}__`;
  const source = await page.evaluate((v) => {
    const script = [...document.querySelectorAll('script')].find((s) => s.textContent?.includes(`window.${v}=`));
    return script?.textContent ?? '';
  }, variable);
  // The inline script is `window.<var>={…};` followed by a `//# sourceURL=` comment that WordPress appends.
  const json = source.slice(source.indexOf('=') + 1, source.lastIndexOf('}') + 1);
  return JSON.parse(json);
}

export async function restNonce(request: APIRequestContext): Promise<string> {
  const response = await request.get('/wp-admin/admin-ajax.php?action=rest-nonce');
  return (await response.text()).trim();
}

export interface ProbeState {
  [namespace: string]: { version: string; path: string; copies: Array<{ version: string; path: string }>; included: string[] };
}

export async function probe(request: APIRequestContext): Promise<ProbeState> {
  const nonce = await restNonce(request);
  const response = await request.get('/index.php?rest_route=/fyldo-probe/v1/state', { headers: { 'X-WP-Nonce': nonce } });
  if (!response.ok()) throw new Error(`probe failed: ${response.status()} ${await response.text()}`);
  return (await response.json()) as ProbeState;
}

/** Wipes every fixture instance's stored settings so tests never depend on each other. */
export async function resetData(request: APIRequestContext): Promise<void> {
  const nonce = await restNonce(request);
  const response = await request.post('/index.php?rest_route=/fyldo-probe/v1/reset', { headers: { 'X-WP-Nonce': nonce } });
  if (!response.ok()) throw new Error(`reset failed: ${response.status()}`);
}

/** WP-CLI in wp-env's cli container, on the same database (the arguments after `--` reach `wp` untouched). */
export function wp(...args: string[]): string {
  return execFileSync('npx', ['wp-env', 'run', 'cli', '--', 'wp', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** `wp … --format=json`, parsed (the last line that is JSON: wp-env may print around it). */
export function wpJson<T = unknown>(...args: string[]): T {
  const output = wp(...args, '--format=json');
  const line = output
    .split('\n')
    .map((l) => l.trim())
    .reverse()
    .find((l) => /^[[{"]/.test(l));
  if (line === undefined) throw new Error(`No JSON from wp ${args.join(' ')}:\n${output}`);
  return JSON.parse(line) as T;
}
