import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { __ } from '../i18n';
import { isValueField, type FieldValue, type PageDef, type ValueFieldDef } from '../types';
import { ApiError, type Api } from './api';
import { validateValue } from './validation';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface FormState {
  values: Record<string, FieldValue>;
  /** Last values known to be stored. */
  saved: Record<string, FieldValue>;
  errors: Record<string, string>;
  revision: string;
  status: SaveStatus;
  message: string;
}

type Action =
  | { type: 'change'; id: string; value: FieldValue }
  | { type: 'discard' }
  | { type: 'invalid'; errors: Record<string, string> }
  | { type: 'saving' }
  | { type: 'saved'; values: Record<string, FieldValue>; revision: string }
  | { type: 'failed'; message: string }
  | { type: 'conflict'; values: Record<string, FieldValue>; revision: string; message: string }
  | { type: 'settle' };

export const valuesEqual = (a: FieldValue | undefined, b: FieldValue | undefined): boolean => JSON.stringify(a) === JSON.stringify(b);

export function initialState(page: PageDef): FormState {
  return { values: { ...page.values }, saved: { ...page.values }, errors: {}, revision: page.revision, status: 'idle', message: '' };
}

export function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case 'change': {
      const { [action.id]: _cleared, ...errors } = state.errors;
      // Editing after a save/failed save starts a new edit session.
      return { ...state, values: { ...state.values, [action.id]: action.value }, errors, status: 'idle', message: '' };
    }
    case 'discard':
      return { ...state, values: { ...state.saved }, errors: {}, status: 'idle', message: '' };
    case 'invalid':
      return { ...state, errors: action.errors, status: 'idle', message: '' };
    case 'saving':
      return { ...state, status: 'saving', message: '', errors: {} };
    case 'saved':
      return { ...state, values: action.values, saved: action.values, revision: action.revision, errors: {}, status: 'saved', message: '' };
    case 'failed':
      return { ...state, status: 'error', message: action.message };
    case 'conflict':
      return { ...state, values: action.values, saved: action.values, revision: action.revision, status: 'error', message: action.message };
    case 'settle':
      return state.status === 'saved' ? { ...state, status: 'idle' } : state;
  }
}

export function dirtyIds(state: FormState): string[] {
  return Object.keys(state.values).filter((id) => !valuesEqual(state.values[id], state.saved[id]));
}

/** Fields that hold a value; a `notice` is display only and never part of the form. */
const valueFields = (page: PageDef): ValueFieldDef[] => page.sections.flatMap((s) => s.fields).filter(isValueField);

/** A stored password the user has not touched is `null` ("keep"): nothing to validate. */
const validateFieldValue = (field: ValueFieldDef, value: FieldValue | undefined): string | null =>
  field.type === 'password' && value === null ? null : validateValue(field.validate, value);

/** How long the "All changes saved" bar stays before it slides out (design decision O15). */
export const SAVED_LINGER_MS = 4000;

export function usePageForm(page: PageDef, api: Api) {
  const [state, dispatch] = useReducer(reducer, page, initialState);
  const dirty = useMemo(() => dirtyIds(state), [state]);
  const fields = useMemo(() => new Map(valueFields(page).map((f) => [f.id, f])), [page]);
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    if (state.status !== 'saved') return undefined;
    const timer = window.setTimeout(() => dispatch({ type: 'settle' }), SAVED_LINGER_MS);
    return () => window.clearTimeout(timer);
  }, [state.status]);

  const setValue = useCallback((id: string, value: FieldValue) => dispatch({ type: 'change', id, value }), []);
  const discard = useCallback(() => dispatch({ type: 'discard' }), []);

  /** Validate one field now (used on blur); returns whether it is valid. */
  const validateField = useCallback(
    (id: string): boolean => {
      const field = fields.get(id);
      if (!field) return true;
      const error = validateFieldValue(field, latest.current.values[id]);
      dispatch({ type: 'invalid', errors: error ? { ...latest.current.errors, [id]: error } : without(latest.current.errors, id) });
      return error === null;
    },
    [fields],
  );

  const save = useCallback(async (): Promise<boolean> => {
    const current = latest.current;
    // A disabled field cannot be changed (the server ignores it too): it is never validated nor sent.
    const changed = dirtyIds(current).filter((id) => fields.get(id)?.disabled === false);

    const errors: Record<string, string> = {};
    for (const id of changed) {
      const field = fields.get(id);
      const error = field ? validateFieldValue(field, current.values[id]) : null;
      if (error) errors[id] = error;
    }
    if (Object.keys(errors).length > 0) {
      dispatch({ type: 'invalid', errors });
      return false;
    }

    dispatch({ type: 'saving' });
    try {
      const payload = Object.fromEntries(changed.map((id) => [id, current.values[id] as FieldValue]));
      const result = await api.savePage(page.id, payload, current.revision);
      dispatch({ type: 'saved', values: result.values, revision: result.revision });
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        dispatch({ type: 'invalid', errors: e.errors });
      } else if (e instanceof ApiError && e.status === 409 && e.data.values && e.data.revision) {
        dispatch({ type: 'conflict', values: e.data.values, revision: e.data.revision, message: e.message });
      } else {
        dispatch({ type: 'failed', message: __("Couldn't save. Check your connection and try again.", 'fyldo') });
      }
      return false;
    }
  }, [api, fields, page.id]);

  return { state, dirty, setValue, discard, save, validateField };
}

function without(errors: Record<string, string>, id: string): Record<string, string> {
  const { [id]: _removed, ...rest } = errors;
  return rest;
}
