import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { RelationItem } from '../types';
import type { ItemsQuery, ItemsResult } from './api';

/** Searches one field's options: `path` is the field id, or `<group>.<sub-field>` inside a group. Given by the page. */
export type RelationSearch = (path: string, query: ItemsQuery, signal?: AbortSignal) => Promise<ItemsResult>;

/** The page's search for its post, term and user fields (SettingsPage provides it; tests and the gallery provide their own). */
export const RelationSearchContext = createContext<RelationSearch | null>(null);

export const useRelationSearch = (): RelationSearch | null => useContext(RelationSearchContext);

/** An item as one line of text: "Summer sale · Page" when it has a hint. */
export const itemText = (item: RelationItem): string => (item.hint ? `${item.label} · ${item.hint}` : item.label);

/** The IDs of a relation field's value: a list (`multiple`) or one ID (0 = none). Anything else is no IDs. */
export const relationIds = (value: unknown): number[] =>
  (Array.isArray(value) ? value : [value]).filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0);

/** Typing settles for this long before a search is sent. */
export const SEARCH_DELAY = 250;

export type ResultsStatus = 'idle' | 'loading' | 'error';

export interface RelationResults {
  /** The results so far (every page loaded), or the previous search's while a new one runs. */
  items: RelationItem[];
  status: ResultsStatus;
  /** At least one answer arrived for the current words (so an empty list means "no results"). */
  loaded: boolean;
  more: boolean;
  /** Ask for the next page (when there is one and nothing is running). */
  loadMore: () => void;
  /** Send the failed request again. */
  retry: () => void;
}

/**
 * The options of a relation field while its menu is open: the first page as soon as it opens (the most recent items),
 * then a new search whenever the typed words settle ({@link SEARCH_DELAY}); older answers that arrive late are ignored.
 * While a search runs the previous results stay, so the list does not flicker.
 */
export function useRelationResults(search: RelationSearch | null, path: string, query: string, open: boolean): RelationResults {
  const [items, setItems] = useState<RelationItem[]>([]);
  const [status, setStatus] = useState<ResultsStatus>('idle');
  const [loaded, setLoaded] = useState(false);
  const [more, setMore] = useState(false);
  const words = useRef('');
  const page = useRef(0);
  const run = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const fetchPage = useCallback(
    (term: string, next: number) => {
      if (!search) return;
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      const id = ++run.current;
      setStatus('loading');
      search(path, { search: term, page: next }, abort.signal).then(
        (result) => {
          if (id !== run.current) return;
          words.current = term;
          page.current = next;
          setItems((previous) => (next === 1 ? result.items : [...previous, ...result.items.filter((item) => !previous.some((p) => p.value === item.value))]));
          setMore(result.more);
          setLoaded(true);
          setStatus('idle');
        },
        () => {
          if (id !== run.current) return;
          setStatus('error');
        },
      );
    },
    [search, path],
  );

  // Opening loads the first page; new words load it again once typing settles. Closing stops whatever is running.
  useEffect(() => {
    if (!open) {
      controller.current?.abort();
      run.current++;
      setStatus('idle');
      setLoaded(false);
      return undefined;
    }
    const term = query.trim();
    if (loaded && term === words.current) return undefined;
    const timer = setTimeout(() => fetchPage(term, 1), loaded || term !== '' ? SEARCH_DELAY : 0);
    return () => clearTimeout(timer);
    // `loaded` is read, not watched: a finished search must not start another one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, fetchPage]);

  useEffect(() => () => controller.current?.abort(), []);

  const loadMore = useCallback(() => {
    if (more && status === 'idle' && loaded) fetchPage(words.current, page.current + 1);
  }, [more, status, loaded, fetchPage]);

  const retry = useCallback(() => fetchPage(query.trim(), loaded && query.trim() === words.current ? page.current + 1 : 1), [fetchPage, query, loaded]);

  return { items, status, loaded, more, loadMore, retry };
}

/** The titles one page's search has seen, per field path: what the selects picked or fetched, shared with a group's headers. */
interface TitleStore {
  titles: Map<string, Map<number, RelationItem>>;
  /** IDs a lookup (`include`) is running or done for, per path: asked once. */
  asked: Map<string, Set<number>>;
  version: number;
  listeners: Set<() => void>;
}

const stores = new WeakMap<object, TitleStore>();
/** The store of a page without a search (tests, the gallery without one). */
const NO_SEARCH = {};

function storeOf(search: RelationSearch | null): TitleStore {
  const key = search ?? NO_SEARCH;
  let store = stores.get(key);
  if (!store) {
    store = { titles: new Map(), asked: new Map(), version: 0, listeners: new Set() };
    stores.set(key, store);
  }
  return store;
}

const bucket = <T>(map: Map<string, T>, path: string, make: () => T): T => {
  let value = map.get(path);
  if (value === undefined) {
    value = make();
    map.set(path, value);
  }
  return value;
};

/** Remember items' titles for a field; listeners hear about it only when something new or changed arrived. */
export function rememberItems(search: RelationSearch | null, path: string, items: RelationItem[]): void {
  const store = storeOf(search);
  const titles = bucket(store.titles, path, () => new Map<number, RelationItem>());
  let changed = false;
  for (const item of items) {
    const before = titles.get(item.value);
    if (!before || before.label !== item.label || before.hint !== item.hint) {
      titles.set(item.value, item);
      changed = true;
    }
  }
  if (!changed) return;
  store.version++;
  store.listeners.forEach((listener) => listener());
}

/**
 * Titles for the IDs of a value: the ones the page already has (`known`, from its `media`), the ones seen since (picked
 * in a select, or a group header's lookup), and the missing ones fetched once with `include` (a field inside a group,
 * whose titles are not in the page's `media`). Re-renders when a title arrives.
 */
export function useKnownItems(search: RelationSearch | null, path: string, ids: number[], known: RelationItem[] = []): Map<number, RelationItem> {
  const store = storeOf(search);
  useSyncExternalStore(
    useCallback(
      (listener: () => void) => {
        store.listeners.add(listener);
        return () => store.listeners.delete(listener);
      },
      [store],
    ),
    () => store.version,
  );

  useEffect(() => rememberItems(search, path, known), [search, path, known]);

  const titles = store.titles.get(path);
  const map = new Map<number, RelationItem>();
  for (const item of known) map.set(item.value, item);
  for (const id of ids) {
    const item = titles?.get(id);
    if (item && !map.has(id)) map.set(id, item);
  }
  const asked = bucket(store.asked, path, () => new Set<number>());
  const key = ids.filter((id) => !map.has(id) && !asked.has(id)).join(',');

  // Not aborted when the component re-renders or goes away: marking the IDs as asked changes `key` at once, and the
  // titles belong to the page's store anyway. `asked` keeps a lookup from being sent twice.
  useEffect(() => {
    if (!search || key === '') return;
    const want = key.split(',').map(Number);
    want.forEach((id) => asked.add(id));
    search(path, { include: want }).then(
      (result) => rememberItems(search, path, result.items),
      () => want.forEach((id) => asked.delete(id)),
    );
  }, [search, path, key, asked]);

  return map;
}
