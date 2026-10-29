/**
 * The forms of an instance: one per page, held by the APP (not by the mounted page), so a page's values, revision and
 * save status survive tab and page switches. A page saves either as a whole (`save: 'global'`, the Save Bar, scope
 * `page`) or card by card (`save: 'section'`, each Section Card footer, scope = the section id) — never both.
 *
 * The same machinery runs a plugin's record form (`<Form>`, app/components/fyldo/Form.tsx): only where the values are
 * stored differs, which is the form's `FormSource`.
 */
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { __ } from '../i18n';
import { isValueField, type FieldValue, type MediaMap, type PageDef, type SectionDef, type ValueFieldDef } from '../types';
import { ApiError, LOGGED_OUT, type Api, type ItemsQuery, type ItemsResult, type SaveResult } from './api';
import { customError } from './custom-fields';
import { belongsTo, groupErrors } from './group';
import { check, messageFor, validateValue } from './validation';
import { visibilityOf, type Resolve } from './dependency';

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
  /** What the media fields (`image`, `file`) and the post, term and user fields draw for their IDs: the saved ones, and what was chosen since. */
  media: MediaMap;
  /** `media` as the server last sent it. */
  savedMedia: MediaMap;
  errors: Record<string, string>;
  revision: string;
  /** Per save scope; a scope that is not listed is idle. */
  scopes: Record<string, ScopeState>;
  /** A save was refused because the stored values changed since this page read them (409): offer to reload them. */
  conflict: boolean;
  /** "Reload latest values" is running. */
  reloading: boolean;
  /** Counts the saves refused for invalid values: a group opens the first item with an error when it changes. */
  reveal: number;
}

/** The scope of a page that saves as a whole. */
export const PAGE_SCOPE = 'page';

export type Action =
  /**
   * `media`: the attachment a media field was just set to (null when cleared), or a post, term or user field's items; the
   * other fields leave it out.
   * `clear`: the error keys the edit makes stale; default every error of the field (a group: its sub-fields' too).
   */
  | { type: 'change'; id: string; value: FieldValue; scope: string; media?: MediaMap[string]; clear?: string[] }
  | { type: 'discard' }
  /** Replace the errors of `ids` with `errors`; with a `scope`, a failed submit: that scope shows the error. */
  | { type: 'invalid'; errors: Record<string, string>; ids: string[]; scope?: string }
  | { type: 'saving'; scope: string; ids: string[] }
  /** `sent`: what the request carried, so an edit made while it ran is kept. */
  | { type: 'saved'; scope: string; sent: Record<string, FieldValue>; values: Record<string, FieldValue>; revision: string; media?: MediaMap }
  | { type: 'failed'; scope: string; message: string }
  | { type: 'conflict'; scope: string; message: string }
  | { type: 'reloading' }
  | { type: 'reloaded'; values: Record<string, FieldValue>; revision: string; media?: MediaMap }
  /** The stored values, re-read when a clean page is shown again: a field edited while the request ran keeps its edit. */
  | { type: 'refreshed'; values: Record<string, FieldValue>; revision: string; media?: MediaMap }
  | { type: 'reload-failed'; message: string }
  | { type: 'settle'; scope: string };

export const valuesEqual = (a: FieldValue | undefined, b: FieldValue | undefined): boolean => JSON.stringify(a) === JSON.stringify(b);

const IDLE: ScopeState = { status: 'idle', message: '' };

export const scopeState = (state: FormState, scope: string): ScopeState => state.scopes[scope] ?? IDLE;

export function initialState(page: Pick<PageDef, 'values' | 'revision' | 'media'>): FormState {
  return {
    values: { ...page.values },
    saved: { ...page.values },
    media: { ...page.media },
    savedMedia: { ...page.media },
    errors: {},
    revision: page.revision,
    scopes: {},
    conflict: false,
    reloading: false,
    reveal: 0,
  };
}

/** `errors` without those of `ids`: a field's own, and a group's sub-field errors (`<group>.<index>.<sub-field>`). */
const without = (errors: Record<string, string>, ids: string[]): Record<string, string> =>
  Object.fromEntries(Object.entries(errors).filter(([key]) => !ids.some((id) => belongsTo(key, id))));

const withScope = (state: FormState, scope: string, next: ScopeState): Record<string, ScopeState> => ({ ...state.scopes, [scope]: next });

/** Couldn't save because fields are invalid (the pack's Save Bar "Error" message). */
export const invalidMessage = (): string => __('Couldn’t save. Check the highlighted fields.', 'fyldo');
export const networkMessage = (): string => __("Couldn't save. Check your connection and try again.", 'fyldo');
export const conflictMessage = (): string => __('Couldn’t save: these settings were changed somewhere else.', 'fyldo');

/**
 * Why a save failed, in words the user can act on. Never the server's own text: a PHP fatal or a proxy's error page says
 * nothing useful here, so the details go to the console for whoever debugs it.
 */
export function saveFailedMessage(error: unknown): string {
  if (!(error instanceof ApiError) || error.status === 0) return networkMessage();
  if (error.code === LOGGED_OUT) return __('Couldn’t save: your login has expired. Log in again, then save.', 'fyldo');

  console.error(`Fyldo: saving failed (${error.status} ${error.code}).`, error.message);
  if (error.status === 403) return __('Couldn’t save: you are not allowed to change these settings.', 'fyldo');
  if (error.status === 413) return __('Couldn’t save: there is too much to send at once.', 'fyldo');
  return __('Couldn’t save: the server ran into a problem. Try again in a moment.', 'fyldo');
}

/**
 * `stored` (the server's values and media) merged with what the user typed since: a field edited while the request ran
 * (it differs from what was `sent`), or dirty and not part of the request (nothing sent: every dirty field), stays.
 */
function mergeStored(state: FormState, stored: Record<string, FieldValue>, storedMedia: MediaMap | undefined, sent: Record<string, FieldValue>) {
  const values: Record<string, FieldValue> = {};
  const media: MediaMap = { ...state.media };
  const kept: string[] = [];
  for (const id of new Set([...Object.keys(stored), ...Object.keys(state.values)])) {
    const local = state.values[id];
    const keepLocal = id in sent ? !valuesEqual(local, sent[id]) : !valuesEqual(local, state.saved[id]);
    if (keepLocal) kept.push(id);
    values[id] = keepLocal ? (local as FieldValue) : (stored[id] as FieldValue);
    // A media field's attachment follows its value: what was chosen since stays, otherwise the server's description.
    if (id in state.media || (storedMedia !== undefined && id in storedMedia)) media[id] = keepLocal ? (state.media[id] ?? null) : (storedMedia?.[id] ?? null);
  }
  return { values, media, kept };
}

export function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case 'change': {
      const current = scopeState(state, action.scope);
      // Editing after a save (or a failed save) starts a new edit session for that scope: "Saved" goes (O15).
      const scopes = current.status === 'saved' || current.status === 'error' ? withScope(state, action.scope, IDLE) : state.scopes;
      const media = action.media === undefined ? state.media : { ...state.media, [action.id]: action.media };
      return { ...state, values: { ...state.values, [action.id]: action.value }, media, errors: without(state.errors, action.clear ?? [action.id]), scopes };
    }
    case 'discard':
      return {
        ...state,
        values: { ...state.saved },
        media: { ...state.savedMedia },
        errors: {},
        scopes: Object.fromEntries(Object.entries(state.scopes).filter(([, s]) => s.status === 'saving')),
      };
    case 'invalid': {
      const errors = { ...without(state.errors, action.ids), ...action.errors };
      const scopes = action.scope ? withScope(state, action.scope, { status: 'error', message: invalidMessage() }) : state.scopes;
      return { ...state, errors, scopes, reveal: action.scope ? state.reveal + 1 : state.reveal };
    }
    case 'saving':
      return { ...state, errors: without(state.errors, action.ids), scopes: withScope(state, action.scope, { status: 'saving', message: '' }) };
    case 'saved': {
      const { values, media } = mergeStored(state, action.values, action.media, action.sent);
      return { ...state, values, media, saved: { ...action.values }, savedMedia: { ...action.media }, revision: action.revision, scopes: withScope(state, action.scope, { status: 'saved', message: '' }) };
    }
    case 'refreshed': {
      // The values are the stored ones now: a refused save's conflict is over, and only a kept edit keeps its errors.
      const { values, media, kept } = mergeStored(state, action.values, action.media, {});
      const errors = Object.fromEntries(Object.entries(state.errors).filter(([key]) => kept.some((id) => belongsTo(key, id))));
      return { ...state, values, media, errors, saved: { ...action.values }, savedMedia: { ...action.media }, revision: action.revision, conflict: false, reloading: false };
    }
    case 'failed':
      return { ...state, scopes: withScope(state, action.scope, { status: 'error', message: action.message }) };
    case 'conflict':
      // The edits stay: the user decides (reload the latest values, or discard).
      return { ...state, conflict: true, scopes: withScope(state, action.scope, { status: 'error', message: action.message }) };
    case 'reloading':
      return { ...state, reloading: true };
    case 'reloaded':
      return { ...initialState({ values: action.values, revision: action.revision, media: action.media }) };
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
  /** Whether a page has unsaved edits (not counting those of fields its `dependency` hides, when the store knows its sections). */
  isDirty(pageId: string): boolean;
  /** Runs `task` after every save already queued for the page: one request at a time, each with the latest revision. */
  enqueue<T>(pageId: string, task: () => Promise<T>): Promise<T>;
}

export function createFormStore(pages: Array<Pick<PageDef, 'id' | 'values' | 'revision' | 'media'> & { sections?: SectionDef[] }>): FormStore {
  const states = new Map(pages.map((p) => [p.id, initialState(p)]));
  const shapes = new Map(pages.flatMap((p) => (p.sections ? [[p.id, p.sections] as const] : [])));
  const listeners = new Set<() => void>();
  const timers = new Map<string, number>();
  const queues = new Map<string, Promise<unknown>>();
  const empty = initialState({ values: {}, revision: '', media: {} });

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
    isDirty: (pageId) => {
      const state = get(pageId);
      const sections = shapes.get(pageId);
      const hidden = sections ? visibilityOf(sections, state.values).hidden : null;
      return dirtyIds(state).some((id) => !hidden?.has(id));
    },
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

/** What a form is made of: a settings page, or a plugin's form (which always saves as a whole). */
export interface FormShape {
  id: string;
  save: 'global' | 'section';
  sections: SectionDef[];
}

/** Where a form's values are stored: a settings page's REST routes, or a record of a plugin's form. */
export interface FormSource {
  save(values: Record<string, FieldValue>, revision: string): Promise<SaveResult>;
  /** The stored values and revision right now (conflict recovery: "Reload latest values"). */
  read(): Promise<SaveResult>;
  /** A Danger Section Card's action; a form without one has no Danger card footer. */
  runAction?(actionId: string, keyword: string): Promise<SaveResult>;
  /** Options of a post, term or user field: `fieldPath` is the field id, or `<group>.<sub-field>`. */
  searchItems?(fieldPath: string, query: ItemsQuery, signal?: AbortSignal): Promise<ItemsResult>;
}

/** A settings page's source: its routes on the instance's REST client. */
export function pageSource(api: Api, pageId: string): FormSource {
  const searchItems = api.searchItems;
  return {
    save: (values, revision) => api.savePage(pageId, values, revision),
    read: () => api.readPage(pageId),
    runAction: (actionId, keyword) => api.runAction(pageId, actionId, keyword),
    ...(searchItems ? { searchItems: (path: string, query: ItemsQuery, signal?: AbortSignal) => searchItems(pageId, path, query, signal) } : {}),
  };
}

export interface FormOptions {
  /** Send (and check) every value field on each save, not only the changed ones: a record is saved as a whole. */
  whole?: boolean;
  /** The Save Bar's text after a 409; default the settings page's. */
  conflictMessage?: () => string;
  /** After a save the store already shows (the Save Bar says Saved). */
  onSaved?: (result: SaveResult) => void;
}

/** Fields that hold a value; a `notice` is display only and never part of the form. */
const valueFields = (form: Pick<FormShape, 'sections'>): ValueFieldDef[] => form.sections.flatMap((s) => s.fields).filter(isValueField);

/**
 * Every message of a field's value, keyed like the server's (a group: per sub-field, without those its items hide;
 * `outside` resolves the page's fields). A stored password the user has not touched is `null` ("keep"): nothing to validate.
 */
function fieldErrors(field: ValueFieldDef, values: Record<string, FieldValue>, outside: Resolve): Record<string, string> {
  const value = values[field.id];
  if (field.type === 'group') return groupErrors(field, value, outside);
  // A code field's CSS message is at its line, keyed `<field>.<line>` as the server keys it.
  if (field.type === 'code') {
    const failure = check(field.validate, value);
    const line = failure?.params.line;
    return failure ? { [typeof line === 'number' ? `${field.id}.${line}` : field.id]: messageFor(failure) } : {};
  }
  const error =
    field.type === 'password' && value === null
      ? null
      : (validateValue(field.validate, value) ?? (field.type === 'custom' ? customError(field, value, (id) => values[id]) : null));
  return error ? { [field.id]: error } : {};
}

/** The save scope a field belongs to: the page, or its section when the page saves per section. */
export function scopeOf(page: FormShape): Map<string, string> {
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
  const source = useMemo(() => pageSource(api, page.id), [api, page.id]);
  return useForm(page, source, shared ?? (own as FormStore));
}

export type FormController = ReturnType<typeof useForm>;

/** A form's state in `store` (under the form's id) and what can be done with it; `source` stores the values. */
export function useForm(form: FormShape, source: FormSource, store: FormStore, options: FormOptions = {}) {
  const { whole = false } = options;
  // Read when a save ends, so a caller's new callbacks never restart anything.
  const latest = useRef(options);
  latest.current = options;
  const state = useSyncExternalStore(store.subscribe, () => store.get(form.id));
  // What the fields' `dependency` shows right now. A hidden field is not part of the form: its edits wait (they are not
  // "unsaved changes" the Save Bar offers), it is never checked nor sent, and the server keeps what is stored.
  const visibility = useMemo(() => visibilityOf(form.sections, state.values), [form.sections, state.values]);
  const dirty = useMemo(() => dirtyIds(state).filter((id) => !visibility.hidden.has(id)), [state, visibility]);
  const fields = useMemo(() => new Map(valueFields(form).map((f) => [f.id, f])), [form]);
  const scopes = useMemo(() => scopeOf(form), [form]);
  const dispatch = useCallback((action: Action) => store.dispatch(form.id, action), [store, form.id]);

  /** `clear`: the error keys the edit makes stale (a group's sub-field edit clears that sub-field only); default all of the field's. */
  const setValue = useCallback(
    (id: string, value: FieldValue, media?: MediaMap[string], clear?: string[]) =>
      dispatch({ type: 'change', id, value, scope: scopes.get(id) ?? PAGE_SCOPE, ...(media === undefined ? {} : { media }), ...(clear ? { clear } : {}) }),
    [dispatch, scopes],
  );
  /** Show a field's own message (a media field: the chosen file is the wrong type or too large); the value stays as it was. */
  const setError = useCallback((id: string, message: string) => dispatch({ type: 'invalid', errors: { [id]: message }, ids: [id] }), [dispatch]);
  const discard = useCallback(() => dispatch({ type: 'discard' }), [dispatch]);

  /**
   * Validate one field now (used on blur); returns whether it is valid. `only`: the error keys of the field at or under a
   * path (a group's item or sub-field, `<group>.<index>.<sub-field>`): the other items are left alone until they are
   * touched or saved.
   */
  const validateField = useCallback(
    (id: string, only?: string): boolean => {
      const field = fields.get(id);
      if (!field) return true;
      const values = store.get(form.id).values;
      const all = fieldErrors(field, values, visibilityOf(form.sections, values).resolve);
      const errors = only === undefined ? all : Object.fromEntries(Object.entries(all).filter(([key]) => belongsTo(key, only)));
      dispatch({ type: 'invalid', errors, ids: [only ?? id] });
      return Object.keys(errors).length === 0;
    },
    [fields, store, form.id, form.sections, dispatch],
  );

  /**
   * Save one scope (the page, or a section): validate its changed fields, then PATCH only those. A `whole` form sends
   * (and checks) every field it holds a value for, once anything changed. Hidden fields are left out.
   */
  const save = useCallback(
    (scope: string = PAGE_SCOPE): Promise<boolean> =>
      store.enqueue(form.id, async () => {
        const current = store.get(form.id);
        const shown = visibilityOf(form.sections, current.values);
        const changed = dirtyIds(current).filter((id) => scopes.get(id) === scope && !shown.hidden.has(id));
        if (changed.length === 0) return true;
        // A disabled field cannot be changed (the server ignores it too): it is never validated nor sent.
        const ids = (whole ? Object.keys(current.values) : changed).filter((id) => fields.get(id)?.disabled === false && !shown.hidden.has(id));
        if (ids.length === 0) return true;

        const errors: Record<string, string> = {};
        for (const id of ids) {
          const field = fields.get(id);
          if (field) Object.assign(errors, fieldErrors(field, current.values, shown.resolve));
        }
        if (Object.keys(errors).length > 0) {
          dispatch({ type: 'invalid', errors, ids, scope });
          return false;
        }

        const sent = Object.fromEntries(ids.map((id) => [id, current.values[id] as FieldValue]));
        dispatch({ type: 'saving', scope, ids });
        try {
          const result = await source.save(sent, current.revision);
          dispatch({ type: 'saved', scope, sent, values: result.values, revision: result.revision, media: result.media });
          latest.current.onSaved?.(result);
          return true;
        } catch (e) {
          if (e instanceof ApiError && e.status === 422) {
            dispatch({ type: 'invalid', errors: e.errors, ids, scope });
          } else if (e instanceof ApiError && e.status === 409) {
            dispatch({ type: 'conflict', scope, message: (latest.current.conflictMessage ?? conflictMessage)() });
          } else {
            dispatch({ type: 'failed', scope, message: saveFailedMessage(e) });
          }
          return false;
        }
      }),
    [source, fields, scopes, store, form.id, form.sections, dispatch, whole],
  );

  /** Replace every value with what is stored now (after a conflict). Unsaved edits on this page are dropped. */
  const reload = useCallback(
    (): Promise<void> =>
      store.enqueue(form.id, async () => {
        dispatch({ type: 'reloading' });
        try {
          const stored = await source.read();
          dispatch({ type: 'reloaded', values: stored.values, revision: stored.revision, media: stored.media });
        } catch (e) {
          const message =
            e instanceof ApiError && e.code === LOGGED_OUT ? e.message : __('Couldn’t load the latest values. Check your connection and try again.', 'fyldo');
          dispatch({ type: 'reload-failed', message });
        }
      }),
    [source, store, form.id, dispatch],
  );

  /**
   * Re-read the stored values when the form has no unsaved edits (a settings page shown again: something else, such as
   * a record's save, may have changed its option since). A dirty form is left as it is: its edits stay, and a save
   * still reports a conflict. Silent: when it fails, the values shown stay and the next save checks the revision.
   */
  const refresh = useCallback(
    (): Promise<void> =>
      store.enqueue(form.id, async () => {
        if (store.isDirty(form.id)) return;
        try {
          const stored = await source.read();
          dispatch({ type: 'refreshed', values: stored.values, revision: stored.revision, media: stored.media });
        } catch {
          // Nothing to say: the page still shows what it read before.
        }
      }),
    [source, store, form.id, dispatch],
  );

  /**
   * A Danger Section Card's action (reset to defaults): runs after any save already queued, then replaces every value
   * with what the server now holds (unsaved edits on the page are dropped: the confirmation says so). Rejects with the
   * ApiError when it fails, so the caller can say why. Undefined when the source has no actions.
   */
  const run = source.runAction;
  const runAction = useMemo(
    () =>
      run
        ? (actionId: string, keyword: string): Promise<void> =>
            store.enqueue(form.id, async () => {
              const result = await run(actionId, keyword);
              dispatch({ type: 'reloaded', values: result.values, revision: result.revision, media: result.media });
            })
        : undefined,
    [run, store, form.id, dispatch],
  );

  return { state, dirty, scopes, visibility, setValue, setError, discard, save, validateField, reload, refresh, runAction };
}
