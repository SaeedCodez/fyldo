/**
 * Client-side routes (docs/ARCHITECTURE.md O7: one admin screen per instance, pages and tabs are routes).
 *
 * The URL is WordPress's own screen URL plus a hash: `options-general.php?page=<slug>#/<page>/<tab>`. The query string is
 * never touched (it selects the admin screen, and may carry other arguments), so every nav item has a real href that
 * works for a new tab, a bookmark, a copied link or a reload. Navigating pushes a history entry; Back/Forward restore
 * the route through `popstate`/`hashchange`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PageDef } from '../types';

export interface Route {
  page: string;
  /** '' when the page has no tabs. */
  tab: string;
}

/** `#/general/identity` → `{ page: 'general', tab: 'identity' }` (unchecked; see `resolveRoute`). */
export function parseHash(hash: string): Route {
  const [page = '', tab = ''] = hash
    .replace(/^#\/?/, '')
    .split('/')
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return '';
      }
    });
  return { page, tab };
}

/** The route the UI shows for a requested one: an unknown page falls back to the first, an unknown tab to the first tab. */
export function resolveRoute(pages: PageDef[], wanted: Route): Route {
  const page = pages.find((p) => p.id === wanted.page) ?? pages[0];
  if (!page) return { page: '', tab: '' };
  const tab = page.tabs.find((t) => t.id === wanted.tab) ?? page.tabs[0];
  return { page: page.id, tab: tab?.id ?? '' };
}

/** `#/<page>` for a page's first tab (the short, canonical link), `#/<page>/<tab>` for any other tab. */
export function routeHash(pages: PageDef[], route: Route): string {
  const page = pages.find((p) => p.id === route.page);
  const first = page?.tabs[0]?.id ?? '';
  const tab = route.tab && route.tab !== first ? `/${encodeURIComponent(route.tab)}` : '';
  return `#/${encodeURIComponent(route.page)}${tab}`;
}

/** The full link of a route: the current screen (path + query, e.g. `?page=acme-seo`) with the route's hash. */
export const routeHref = (pages: PageDef[], route: Route): string =>
  `${window.location.pathname}${window.location.search}${routeHash(pages, route)}`;

const sameRoute = (a: Route, b: Route): boolean => a.page === b.page && a.tab === b.tab;

export interface Router {
  route: Route;
  /** Push (or replace) a history entry for `route` and show it. No-op when it is already shown. */
  navigate: (route: Route, options?: { replace?: boolean }) => void;
  /** Which kind of change produced the current route: the first render, the app itself, or Back/Forward. */
  cause: 'initial' | 'navigate' | 'history';
}

export function useRouter(pages: PageDef[]): Router {
  const [state, setState] = useState<{ route: Route; cause: Router['cause'] }>(() => ({
    route: resolveRoute(pages, parseHash(window.location.hash)),
    cause: 'initial',
  }));

  const shown = useRef(state.route);
  shown.current = state.route;

  useEffect(() => {
    // Read the URL: show its route, and correct IN PLACE (no history entry) a hash that names something that does not
    // exist — an old bookmark, a typo, a hand-edited URL.
    const read = (cause: Router['cause']): void => {
      const hash = window.location.hash;
      const wanted = parseHash(hash);
      const next = resolveRoute(pages, wanted);
      if (
        hash !== '' &&
        hash !== '#' &&
        (wanted.page !== next.page || (wanted.tab !== '' && wanted.tab !== next.tab))
      ) {
        window.history.replaceState(window.history.state, '', routeHash(pages, next));
      }
      setState((current) => (sameRoute(current.route, next) ? current : { route: next, cause }));
    };
    read('initial');
    // `popstate` covers Back/Forward over pushState entries; `hashchange` a hash edited by hand or a plain link.
    const sync = (): void => read('history');
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, [pages]);

  const navigate = useCallback(
    (wanted: Route, options: { replace?: boolean } = {}) => {
      const next = resolveRoute(pages, wanted);
      if (sameRoute(shown.current, next)) return;
      const hash = routeHash(pages, next);
      if (window.location.hash !== hash) {
        if (options.replace) window.history.replaceState(window.history.state, '', hash);
        else window.history.pushState(null, '', hash);
      }
      setState({ route: next, cause: 'navigate' });
    },
    [pages],
  );

  return { route: state.route, cause: state.cause, navigate };
}
