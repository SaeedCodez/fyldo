/**
 * The forms of an instance: one per page, held by the APP (not by the mounted page), so a page's values, revision and
 * save status survive tab and page switches. A page saves either as a whole (`save: 'global'`, the Save Bar, scope
 * `page`) or card by card (`save: 'section'`, each Section Card footer, scope = the section id) — never both.
 */
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { __ } from '../i18n';
import { isValueField, type FieldValue, type PageDef, type ValueFieldDef } from '../types';
import { ApiError, type Api } from './api';
import { validateValue } from './validation';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** The save status of one scope: the page (Save Bar) or one section (its card footer). */
export interface ScopeState {
  status: SaveStatus;
  message: string;
}

export interface FormState {
  values: Record<string, FieldValue>;
  /** Last values known to be stored. */
  saved: Record<string, FieldValue>;
  errors: Record<string, string>;
  revision: string;
  /** Per save scope; a scope that is not listed is idle. */
  scopes: Record<string, ScopeState>;
  /** A save was refused because the stored values changed since this page read them (409): offer to reload them. */
  conflict: boolean;
  /** "Reload latest values" is running. */
  reloading: boolean;
}

/** The scope of a page that saves as a whole. */
export const PAGE_SCOPE = 'page';

export type Action =
  | { type: 'change'; id: string; value: FieldValue; scope: string }
  | { type: 'discard' }
  /** Replace the errors of `ids` with `errors`; with a `scope`, a failed submit: that scope shows the error. */
  | { type: 'invalid'; errors: Record<string, string>; ids: string[]; scope?: string }
  | { type: 'saving'; scope: string; ids: string[] }
  /** `sent`: what the request carried, so an edit made while it ran is kept. */
  | { type: 'saved'; scope: string; sent: Record<string, FieldValue>; values: Record<string, FieldValue>; revision: string }
  | { type: 'failed'; scope: string; message: string }
  | { type: 'conflict'; scope: string; message: string }
  | { type: 'reloading' }
  | { type: 'reloaded'; values: Record<string, FieldValue>; revision: string }
  | { type: 'reload-failed'; message: string }
  | { type: 'settle'; scope: string };

export const valuesEqual = (a: FieldValue | undefined, b: FieldValue | undefined): boolean => JSON.stringify(a) === JSON.stringify(b);

const IDLE: ScopeState = { status: 'idle', message: '' };

export const scopeState = (state: FormState, scope: string): ScopeState => state.scopes[scope] ?? IDLE;

export function initialState(page: Pick<PageDef, 'values' | 'revision'>): FormState {
  return { values: { ...page.values }, saved: { ...page.values }, errors: {}, revision: page.revision, scopes: {}, conflict: false, reloading: false };
}

const without = (errors: Record<string, string>, ids: string[]): Record<string, string> =>
  Object.fromEntries(Object.entries(errors).filter(([id]) => !ids.includes(id)));

const withScope = (state: FormState, scope: string, next: ScopeState): Record<string, ScopeState> => ({ ...state.scopes, [scope]: next });

/** Couldn't save because fields are invalid (the pack's Save Bar "Error" message). */
export const invalidMessage = (): string => __('Couldn’t save. Check the highlighted fields.', 'fyldo');
export const networkMessage = (): string => __("Couldn't save. Check your connection and try again.", 'fyldo');
export const conflictMessage = (): string => __('Couldn’t save: these settings were changed somewhere else.', 'fyldo');

export function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case 'change': {
      const current = scopeState(state, action.scope);
      // Editing after a save (or a failed save) starts a new edit session for that scope: "Saved" goes (O15).
      const scopes = current.status === 'saved' || current.status === 'error' ? withScope(state, action.scope, IDLE) : state.scopes;
      return { ...state, values: { ...state.values, [action.id]: action.value }, errors: without(state.errors, [action.id]), scopes };
    }
    case 'discard':
      return {
        ...state,
        values: { ...state.saved },
        errors: {},
        scopes: Object.fromEntries(Object.entries(state.scopes).filter(([, s]) => s.status === 'saving')),
      };
    case 'invalid': {
      const errors = { ...without(state.errors, action.ids), ...action.errors };
      const scopes = action.scope ? withScope(state, action.scope, { status: 'error', message: invalidMessage() }) : state.scopes;
      return { ...state, errors, scopes };
    }
    case 'saving':
      return { ...state, errors: without(state.errors, action.ids), scopes: withScope(state, action.scope, { status: 'saving', message: '' }) };
    case 'saved': {
      const values: Record<string, FieldValue> = {};
      for (const id of new Set([...Object.keys(action.values), ...Object.keys(state.values)])) {
        const local = state.values[id];
        // Keep what the user typed since: a field edited while the request ran, or dirty and not part of this save.
        const keepLocal = id in action.sent ? !valuesEqual(local, action.sent[id]) : !valuesEqual(local, state.saved[id]);
        values[id] = keepLocal ? (local as FieldValue) : (action.values[id] as FieldValue);
      }
      return { ...state, values, saved: { ...action.values }, revision: action.revision, scopes: withScope(state, action.scope, { status: 'saved', message: '' }) };
    }
    case 'failed':
      return { ...state, scopes: withScope(state, action.scope, { status: 'error', message: action.message }) };
    case 'conflict':
      // The edits stay: the user decides (reload the latest values, or discard).
      return { ...state, conflict: true, scopes: withScope(state, action.scope, { status: 'error', message: action.message }) };
    case 'reloading':
      return { ...state, reloading: true };
    case 'reloaded':
      return { ...initialState({ values: action.values, revision: action.revision }) };
    case 'reload-failed':
      return { ...state, reloading: false, scopes: withScope(state, PAGE_SCOPE, { status: 'error', message: action.message }) };
    case 'settle':
      return scopeState(state, action.scope).status === 'saved' ? { ...state, scopes: withScope(state, action.scope, IDLE) } : state;
  }
}

export function dirtyIds(state: FormState): string[] {
  return Object.keys(state.values).filter((id) => !valuesEqual(state.values[id], state.saved[id]));
}

/** How long "All changes saved" stays before it slides out, unless the user edits first (design decision O15). */
export const SAVED_LINGER_MS = 4000;

/** Every page's form, outside React so that it outlives the page component. */
export interface FormStore {
  get(pageId: string): FormState;
  dispatch(pageId: string, action: Action): void;
  subscribe(listener: () => void): () => void;
  /** Whether a page has unsaved edits. */
  isDirty(pageId: string): boolean;
  /** Runs `task` after every save already queued for the page: one request at a time, each with the latest revision. */
  enqueue<T>(pageId: string, task: () => Promise<T>): Promise<T>;
}

export function createFormStore(pages: Array<Pick<PageDef, 'id' | 'values' | 'revision'>>): FormStore {
  const states = new Map(pages.map((p) => [p.id, initialState(p)]));
  const listeners = new Set<() => void>();
  const timers = new Map<string, number>();
  const queues = new Map<string, Promise<unknown>>();
  const empty = initialState({ values: {}, revision: '' });

  const get = (pageId: string): FormState => states.get(pageId) ?? empty;

  const dispatch = (pageId: string, action: Action): void => {
    const before = get(pageId);
    const after = reducer(before, action);
    if (after === before) return;
    states.set(pageId, after);

    if (action.type === 'saved') {
      const key = `${pageId}\u0000${action.scope}`;
      window.clearTimeout(timers.get(key));
      timers.set(
        key,
        window.setTimeout(() => {
          timers.delete(key);
          dispatch(pageId, { type: 'settle', scope: action.scope });
        }, SAVED_LINGER_MS),
      );
    }
    listeners.forEach((l) => l());
  };

  return {
    get,
    dispatch,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isDirty: (pageId) => dirtyIds(get(pageId)).length > 0,
    enqueue(pageId, task) {
      const run = (queues.get(pageId) ?? Promise.resolve()).then(task, task);
      queues.set(
        pageId,
        run.catch(() => undefined),
      );
      return run;
    },
  };
}

/** Fields that hold a value; a `notice` is display only and never part of the form. */
const valueFields = (page: PageDef): ValueFieldDef[] => page.sections.flatMap((s) => s.fields).filter(isValueField);

/** A stored password the user has not touched is `null` ("keep"): nothing to validate. */
const validateFieldValue = (field: ValueFieldDef, value: FieldValue | undefined): string | null =>
  field.type === 'password' && value === null ? null : validateValue(field.validate, value);

/** The save scope a field belongs to: the page, or its section when the page saves per section. */
export function scopeOf(page: PageDef): Map<string, string> {
  const map = new Map<string, string>();
  for (const section of page.sections)
    for (const field of section.fields) if (isValueField(field)) map.set(field.id, page.save === 'section' ? section.id : PAGE_SCOPE);
  return map;
}

/**
 * The form of one page, read from the store (a store of its own when none is given: a page rendered on its own).
 */
export function usePageForm(page: PageDef, api: Api, shared?: FormStore) {
  const [own] = useState(() => (shared ? null : createFormStore([page])));
  const store = shared ?? (own as FormStore);
  const state = useSyncExternalStore(store.subscribe, () => store.get(page.id));
  const dirty = useMemo(() => dirtyIds(state), [state]);
  const fields = useMemo(() => new Map(valueFields(page).map((f) => [f.id, f])), [page]);
  const scopes = useMemo(() => scopeOf(page), [page]);
  const dispatch = useCallback((action: Action) => store.dispatch(page.id, action), [store, page.id]);

  const setValue = useCallback(
    (id: string, value: FieldValue) => dispatch({ type: 'change', id, value, scope: scopes.get(id) ?? PAGE_SCOPE }),
    [dispatch, scopes],
  );
  const discard = useCallback(() => dispatch({ type: 'discard' }), [dispatch]);

  /** Validate one field now (used on blur); returns whether it is valid. */
  const validateField = useCallback(
    (id: string): boolean => {
      const field = fields.get(id);
      if (!field) return true;
      const error = validateFieldValue(field, store.get(page.id).values[id]);
      dispatch({ type: 'invalid', errors: error ? { [id]: error } : {}, ids: [id] });
      return error === null;
    },
    [fields, store, page.id, dispatch],
  );

  /** Save one scope (the page, or a section): validate its changed fields, then PATCH only those. */
  const save = useCallback(
    (scope: string = PAGE_SCOPE): Promise<boolean> =>
      store.enqueue(page.id, async () => {
        const current = store.get(page.id);
        // A disabled field cannot be changed (the server ignores it too): it is never validated nor sent.
        const changed = dirtyIds(current).filter((id) => scopes.get(id) === scope && fields.get(id)?.disabled === false);
        if (changed.length === 0) return true;

        const errors: Record<string, string> = {};
        for (const id of changed) {
          const field = fields.get(id);
          const error = field ? validateFieldValue(field, current.values[id]) : null;
          if (error) errors[id] = error;
        }
        if (Object.keys(errors).length > 0) {
          dispatch({ type: 'invalid', errors, ids: changed, scope });
          return false;
        }

        const sent = Object.fromEntries(changed.map((id) => [id, current.values[id] as FieldValue]));
        dispatch({ type: 'saving', scope, ids: changed });
        try {
          const result = await api.savePage(page.id, sent, current.revision);
          dispatch({ type: 'saved', scope, sent, values: result.values, revision: result.revision });
          return true;
        } catch (e) {
          if (e instanceof ApiError && e.status === 422) {
            dispatch({ type: 'invalid', errors: e.errors, ids: changed, scope });
          } else if (e instanceof ApiError && e.status === 409) {
            dispatch({ type: 'conflict', scope, message: conflictMessage() });
          } else {
            dispatch({ type: 'failed', scope, message: networkMessage() });
          }
          return false;
        }
      }),
    [api, fields, scopes, store, page.id, dispatch],
  );

  /** Replace every value with what is stored now (after a conflict). Unsaved edits on this page are dropped. */
  const reload = useCallback(
    (): Promise<void> =>
      store.enqueue(page.id, async () => {
        dispatch({ type: 'reloading' });
        try {
          const latest = await api.readPage(page.id);
          dispatch({ type: 'reloaded', values: latest.values, revision: latest.revision });
        } catch {
          dispatch({ type: 'reload-failed', message: __('Couldn’t load the latest values. Check your connection and try again.', 'fyldo') });
        }
      }),
    [api, store, page.id, dispatch],
  );

  /**
   * A Danger Section Card's action (reset to defaults): runs after any save already queued, then replaces every value
   * with what the server now holds (unsaved edits on the page are dropped: the confirmation says so). Rejects with the
   * ApiError when it fails, so the caller can say why.
   */
  const runAction = useCallback(
    (actionId: string, keyword: string): Promise<void> =>
      store.enqueue(page.id, async () => {
        const result = await api.runAction(page.id, actionId, keyword);
        dispatch({ type: 'reloaded', values: result.values, revision: result.revision });
      }),
    [api, store, page.id, dispatch],
  );

  return { state, dirty, scopes, setValue, discard, save, validateField, reload, runAction };
}
