import { useCallback, useEffect, useId, useMemo, useRef, useState, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { __ } from '../../i18n';
import { Spinner } from '../../icons/Spinner';
import { ApiError, LOGGED_OUT, type RecordsApi } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useDirtyScope } from '../../lib/dirty';
import { belongsTo } from '../../lib/group';
import { useFormHost } from '../../lib/host';
import { createFormStore, PAGE_SCOPE, scopeState, useForm as useFormController, type FormController, type FormShape, type FormSource } from '../../lib/page-form';
import type { RelationSearch } from '../../lib/relation';
import { isValueField, mediaItem, type DateRangeValue, type FieldDef, type FieldValue, type FormDef, type MediaItem, type SectionDef } from '../../types';
import { Button } from '../ui/button';
import { Notice } from '../ui/notice';
import { ConflictNotice, FormBody, saveBarState, useSaveShortcut } from './FormBody';
import { SaveBar } from './SaveBar';

export interface FormProps {
  /** The id of a form registered in PHP. */
  form: string;
  /** The record's key, or 'new' for one that does not exist yet. */
  record: string;
  /** After every save: the record's key (the new one after creating it) and its stored values. */
  onSaved?: (key: string, values: Record<string, FieldValue>) => void;
}

/** The key of a record not created yet. */
export const NEW_RECORD = 'new';

/** The form's entry in its own store (one form per store). */
const STATE = 'record';

type Load = { status: 'loading' } | { status: 'ready' } | { status: 'missing' } | { status: 'failed'; message: string };

const NO_SECTIONS: SectionDef[] = [];

const unavailable = (): string => __('This form couldn’t be loaded.', 'fyldo');

/**
 * A plugin's record form on a custom page (the SDK's `Form`): exactly what a settings page draws below its header — the
 * Section Cards with Fyldo's fields, the Save Bar, the conflict Notice — over the plugin's own storage
 * (`…/forms/{form}/records/{key}`). Its state is its own, not the app's: it lives as long as the Form is on screen.
 *
 * A function declaration on purpose: the SDK object takes it while an import cycle is evaluated (app/lib/sdk.ts).
 */
export function Form({ form, record, onSaved }: FormProps): ReactElement {
  const host = useFormHost();
  const def = host?.forms.find((f) => f.id === form);
  useMissingFormReport(host !== null, def !== undefined, form, '<Form>');

  if (!host || !def) {
    return (
      <Notice className="fy:mt-6" tone="red">
        {unavailable()}
      </Notice>
    );
  }
  // Another form is another state: start over. A key may come as a number from plain JavaScript: keys are compared as text.
  return <RecordForm key={def.id} def={def} api={host.api} locale={host.locale} record={String(record)} onSaved={onSaved} />;
}

/** Says in the console why a form cannot work: outside Fyldo's screen, or not registered in PHP. */
function useMissingFormReport(hosted: boolean, registered: boolean, form: string, what: string): void {
  useEffect(() => {
    if (!hosted) console.error(`Fyldo: ${what} works only inside Fyldo’s admin screen (a custom page).`);
    else if (!registered) console.error(`Fyldo: there is no form "${form}": register it in PHP.`);
  }, [hosted, registered, form, what]);
}

/** A record form's machinery: loading the record, its state, saving it. `Form` draws it with Fyldo's fields; `useForm` hands it to the page. */
interface RecordEngine {
  shape: FormShape;
  controller: FormController;
  load: Load;
  /** Load the record again (after a failed load); undefined when the form cannot work at all. */
  retry?: () => void;
  search: RelationSearch;
}

/**
 * The one implementation of a record form. `def` null: the form is not registered (or there is no Fyldo screen): it never
 * loads and says so.
 */
function useRecordEngine(def: FormDef | null, api: RecordsApi | null, record: string, onSaved: FormProps['onSaved']): RecordEngine {
  const formId = def?.id ?? '';
  // One form per engine: `Form` remounts for another form; a page using `useForm` gives another form another component.
  const [store] = useState(() => createFormStore([]));
  const sections = def?.sections ?? NO_SECTIONS;
  const shape = useMemo<FormShape>(() => ({ id: STATE, save: 'global', sections }), [sections]);
  // The record the values belong to: `record`, until saving a new one gives it its key.
  const key = useRef<string | null>(null);
  const [load, setLoad] = useState<Load>(() => (def && api ? { status: 'loading' } : { status: 'failed', message: unavailable() }));
  const run = useRef(0);
  const saved = useRef(onSaved);
  saved.current = onSaved;

  const fetchRecord = useCallback(
    (wanted: string) => {
      if (!api || formId === '') return;
      const id = ++run.current;
      setLoad({ status: 'loading' });
      api.readRecord(formId, wanted).then(
        (result) => {
          if (id !== run.current) return;
          store.dispatch(STATE, { type: 'reloaded', values: result.values, revision: result.revision, media: result.media });
          setLoad({ status: 'ready' });
        },
        (error: unknown) => {
          if (id !== run.current) return;
          if (error instanceof ApiError && error.status === 404) {
            setLoad({ status: 'missing' });
            return;
          }
          if (!(error instanceof ApiError) || error.status !== 0) console.error(`Fyldo: loading record "${wanted}" of form "${formId}" failed.`, error);
          setLoad({
            status: 'failed',
            message: error instanceof ApiError && error.code === LOGGED_OUT ? error.message : __('Couldn’t load this item. Check your connection and try again.', 'fyldo'),
          });
        },
      );
    },
    [api, formId, store],
  );

  // A new `record` loads it — unless it is the key a save just gave the new record: those values are already here.
  useEffect(() => {
    if (key.current === record || !api || formId === '') return;
    key.current = record;
    store.dispatch(STATE, { type: 'reloaded', values: {}, revision: '' }); // the defaults while it loads
    fetchRecord(record);
  }, [record, fetchRecord, store, api, formId]);

  const source = useMemo<FormSource>(
    () => ({
      save: async (values, revision) => {
        if (!api) throw new Error(`Fyldo: form "${formId}" cannot save outside Fyldo’s admin screen.`);
        const result = await api.saveRecord(formId, key.current ?? NEW_RECORD, values, revision);
        if (result.key) key.current = result.key;
        return result;
      },
      read: () => (api ? api.readRecord(formId, key.current ?? NEW_RECORD) : Promise.reject(new Error(unavailable()))),
    }),
    [api, formId],
  );
  const search = useMemo<RelationSearch>(
    () => (path, query, signal) => (api ? api.searchRecordItems(formId, path, query, signal) : Promise.reject(new Error(unavailable()))),
    [api, formId],
  );

  const controller = useFormController(shape, source, store, {
    whole: true,
    conflictMessage: () => __('Couldn’t save: this item was changed somewhere else.', 'fyldo'),
    onSaved: (result) => saved.current?.(key.current ?? '', result.values),
  });

  // The custom page's unsaved-changes guard asks the store itself, so a save the parent reacts to at once (navigating
  // away in `onSaved`) is already counted as saved.
  const dirtyScope = useDirtyScope();
  const entry = useId();
  useEffect(() => {
    if (!dirtyScope) return undefined;
    dirtyScope.set(entry, { isDirty: () => store.isDirty(STATE), discard: () => store.dispatch(STATE, { type: 'discard' }) });
    return () => dirtyScope.set(entry, null);
  }, [dirtyScope, entry, store]);

  const retry = useCallback(() => fetchRecord(key.current ?? record), [fetchRecord, record]);
  return { shape, controller, load, retry: def && api ? retry : undefined, search };
}

/** A record that does not exist, or could not be loaded (with Retry). Nothing while it loads or once it is there. */
function LoadNotice({ load, onRetry }: { load: Load; onRetry?: () => void }): ReactElement | null {
  if (load.status === 'missing') {
    return (
      <Notice className="fy:mt-6" tone="amber" live>
        {__('This item doesn’t exist. It may have been deleted.', 'fyldo')}
      </Notice>
    );
  }
  if (load.status === 'failed') {
    return (
      <Notice
        className="fy:mt-6"
        tone="red"
        live
        action={
          onRetry ? (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {__('Retry', 'fyldo')}
            </Button>
          ) : undefined
        }
      >
        {load.message}
      </Notice>
    );
  }
  return null;
}

/** "Loading…" over the first card's header (at its end, inside its padding), so the cards never move when the values arrive. */
function LoadingStatus({ loading }: { loading: boolean }): ReactElement {
  return (
    <div
      role="status"
      className={
        loading
          ? 'fy:absolute fy:end-8 fy:top-14 fy:z-10 fy:flex fy:items-center fy:gap-2 fy:rounded-full fy:border fy:border-border-default fy:bg-background-default fy:px-3 fy:py-1 fy:text-label-14 fy:text-text-secondary fy:shadow-small'
          : 'fy:sr-only'
      }
    >
      {loading ? (
        <>
          <Spinner />
          <span>{__('Loading…', 'fyldo')}</span>
        </>
      ) : null}
    </div>
  );
}

interface RecordFormProps extends Omit<FormProps, 'form'> {
  def: FormDef;
  api: RecordsApi;
  locale: string;
}

function RecordForm({ def, api, locale, record, onSaved }: RecordFormProps): ReactElement {
  const engine = useRecordEngine(def, api, record, onSaved);
  const container = useRef<HTMLDivElement>(null);
  const { load } = engine;

  if (load.status === 'missing' || load.status === 'failed') return <LoadNotice load={load} onRetry={engine.retry} />;

  const loading = load.status === 'loading';
  return (
    <div ref={container} data-slot="fy-form" data-form={def.id} className="fy:relative fy:flex fy:flex-col">
      <LoadingStatus loading={loading} />
      <FormBody form={engine.shape} controller={engine.controller} container={container} search={engine.search} locale={locale} kind="record" busy={loading} />
    </div>
  );
}

// ── useForm: the same form, drawn by the page ──────────────────────────────────────────────────────────────────────────

/**
 * The props of each kind of control, with the value in the control's own type (`field(id, kind)`): spread one onto its
 * control (`<ui.Input {...form.field('title', 'text')} />`) with no narrowing in TypeScript.
 */
export interface FieldBindings {
  /** `ui.Input`, `Textarea`, `Select`, `RadioGroup`, `SegmentedControl`, `ChoiceCards`, `ColorPicker`, `DatePicker`, `TimePicker`, `CodeEditor`: not a string = ''. */
  text: { value: string; onValueChange: (value: string) => void; onBlur: () => void; disabled: boolean };
  /** `ui.NumberInput` (a number, or the text being typed): neither = ''. */
  number: { value: number | string; onValueChange: (value: number | string) => void; onBlur: () => void; disabled: boolean };
  /** `ui.MultiSelect`, `CheckboxGroup`: the strings of the list; not a list = []. */
  list: { value: string[]; onValueChange: (value: string[]) => void; onBlur: () => void; disabled: boolean };
  /** `ui.DateRangePicker`: each end a string; a missing end = ''. */
  range: { value: DateRangeValue; onValueChange: (value: DateRangeValue) => void; onBlur: () => void; disabled: boolean };
  /** `ui.Toggle`, `Checkbox`: Base UI's checked state; anything but `true` = off. */
  toggle: { checked: boolean; onCheckedChange: (checked: boolean) => void; disabled: boolean };
  /** `ui.MediaPicker`: the attachment ID (not a number = 0), the attachment it draws, and its change. */
  media: { value: number; media: MediaItem | null; onValueChange: (value: number, item: MediaItem | null) => void; onBlur: () => void; disabled: boolean };
}

/** A kind of control `field(id, kind)` binds. */
export type FieldKind = keyof FieldBindings;

/** What a control needs from the form, spread onto it (`h(ui.Input, form.field('title'))`): depends on the field's type. */
export type FieldBinding =
  /** `toggle`, `checkbox`: Base UI's checked state. */
  | FieldBindings['toggle']
  /** `image`, `file`: `ui.MediaPicker`'s value, the attachment it draws, and its change. */
  | FieldBindings['media']
  /** Every other type: the value and its change, and blur (the moment Fyldo's fields check a value). */
  | { value: FieldValue; onValueChange: (value: FieldValue) => void; onBlur: () => void; disabled: boolean };

/** The kind of control each field type is drawn with; the others (`post`, `group`, `custom`…) bind as any kind. */
const KIND_OF: Partial<Record<FieldDef['type'], FieldKind>> = {
  text: 'text', url: 'text', email: 'text', password: 'text', textarea: 'text', code: 'text', select: 'text', radio: 'text',
  choice: 'text', segmented: 'text', color: 'text', icon: 'text', date: 'text', time: 'text', datetime: 'text',
  number: 'number', slider: 'number',
  multi_select: 'list', checkbox_group: 'list',
  date_range: 'range', time_range: 'range', datetime_range: 'range',
  toggle: 'toggle', checkbox: 'toggle',
  image: 'media', file: 'media',
};

const asList = (value: FieldValue): string[] => (Array.isArray(value) ? (value as unknown[]).filter((v): v is string => typeof v === 'string') : []);

function asRange(value: FieldValue): DateRangeValue {
  const pair = value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return { start: typeof pair.start === 'string' ? pair.start : '', end: typeof pair.end === 'string' ? pair.end : '' };
}

/** A record form whose page draws the fields itself (the SDK's `useForm`); Fyldo keeps loading, checking and saving. */
export interface RecordFormApi {
  /** `loading` (the defaults are in `values`), `ready`, `missing` (no such record) or `failed` (`Frame` says why). */
  status: Load['status'];
  /** Every field's current value: the record's, with this session's edits, and the defaults while it loads. */
  values: Record<string, FieldValue>;
  /** Every message, keyed by field id or by a path inside a value (`slides.2.link`). */
  errors: Readonly<Record<string, string>>;
  /** The message of a field or a path, if any. */
  error: (path: string) => string | undefined;
  /** How many messages a field or a path holds, its own and those inside it (a Group Item's `errorCount`). */
  errorCount: (path: string) => number;
  /** There are unsaved edits. */
  dirty: boolean;
  saving: boolean;
  /** Counts the saves refused for invalid values: open the items that hold errors when it grows. */
  invalidSaves: number;
  /** Set a field's value. `clear`: the message keys the edit makes stale (default: all of the field's). */
  set: (id: string, value: FieldValue, options?: { clear?: string[] }) => void;
  /**
   * Props for the control of field `id`: by its type, or with `kind`, the props of that kind of control, its value in
   * the control's type (TypeScript then needs no narrowing). A kind that does not match the field's type is reported.
   */
  field: {
    (id: string): FieldBinding;
    <K extends FieldKind>(id: string, kind: K): FieldBindings[K];
  };
  /** Check a field now (on blur); `path` checks one message key of it. Returns whether it is valid. */
  validate: (id: string, path?: string) => boolean;
  /** Check every field, then save the record; false when it was refused or failed (the Save Bar says why). */
  save: () => Promise<boolean>;
  discard: () => void;
  /** Draws what surrounds the page's fields: the load and conflict notices, the Save Bar, Ctrl/⌘+S, focus on the first invalid control. */
  Frame: ComponentType<{ children?: ReactNode }>;
}

/** The first control to focus after a refused save: an invalid control, or the first control of an invalid Setting Row. */
const INVALID =
  '[aria-invalid="true"], [data-slot="fy-setting-row"][data-invalid] :is(input, textarea, button, [role="switch"], [role="combobox"], [role="checkbox"], [role="radio"])';

function RecordFrame({ engine, formId, children }: { engine: RecordEngine; formId: string; children?: ReactNode }): ReactElement {
  const container = useRef<HTMLDivElement>(null);
  const { controller, load } = engine;
  const { state, dirty, save, discard, reload } = controller;
  const page = scopeState(state, PAGE_SCOPE);
  const submit = (): void => void save();

  useSaveShortcut(container, () => {
    if (dirty.length > 0 && page.status !== 'saving') submit();
  });

  // After a refused save, focus the first invalid control the page shows (an item that is closed: the page opens it).
  const lastReveal = useRef(state.reveal);
  useEffect(() => {
    if (state.reveal === lastReveal.current) return;
    lastReveal.current = state.reveal;
    container.current?.querySelector<HTMLElement>(INVALID)?.focus();
  }, [state.reveal]);

  if (load.status === 'missing' || load.status === 'failed') return <LoadNotice load={load} onRetry={engine.retry} />;

  const loading = load.status === 'loading';
  return (
    <div ref={container} data-slot="fy-form" data-form={formId} className="fy:relative fy:flex fy:flex-col">
      <LoadingStatus loading={loading} />
      {state.conflict ? <ConflictNotice kind="record" reloading={state.reloading} onReload={() => void reload()} /> : null}
      <div inert={loading || undefined} aria-busy={loading || undefined} className={cn('fy:mt-6 fy:flex fy:flex-col fy:gap-6', loading && 'fy:opacity-60')}>
        {children}
      </div>
      <SaveBar state={saveBarState(state, dirty)} errorMessage={page.message || undefined} onSave={submit} onDiscard={discard} />
    </div>
  );
}

/**
 * A plugin's record form whose page draws the fields itself (the SDK's `useForm`): for an editor whose fields depend on
 * each other or that shows a live preview. Loading, the checks, saving (409, 422), the unsaved-changes guard and the
 * Save Bar are Fyldo's, exactly as for `Form`; `Frame` draws them around the page's fields.
 *
 * A function declaration on purpose: the SDK object takes it while an import cycle is evaluated (app/lib/sdk.ts).
 */
export function useRecordForm({ form, record, onSaved }: FormProps): RecordFormApi {
  const host = useFormHost();
  const def = host?.forms.find((f) => f.id === form) ?? null;
  useMissingFormReport(host !== null, def !== null, form, 'useForm');
  const engine = useRecordEngine(def, host?.api ?? null, String(record), onSaved);
  const { controller, load } = engine;
  const { state } = controller;

  const fields = useMemo(() => new Map((def?.sections ?? NO_SECTIONS).flatMap((s) => s.fields).filter(isValueField).map((f) => [f.id, f])), [def]);
  const values = useMemo(() => {
    const merged: Record<string, FieldValue> = {};
    for (const [id, f] of fields) merged[id] = id in state.values ? (state.values[id] as FieldValue) : f.default;
    return merged;
  }, [fields, state.values]);

  // `Frame` is one component for the life of the form (a new one would remount the page's fields); it draws what the
  // engine holds at the page's latest render.
  const live = useRef({ engine, formId: form });
  live.current = { engine, formId: form };
  const [Frame] = useState(() => {
    function Frame({ children }: { children?: ReactNode }): ReactElement {
      return (
        <RecordFrame engine={live.current.engine} formId={live.current.formId}>
          {children}
        </RecordFrame>
      );
    }
    return Frame;
  });

  const loading = load.status === 'loading';
  const bind = (id: string, kind?: FieldKind): FieldBindings[FieldKind] | FieldBinding => {
    const f = fields.get(id);
    if (!f) console.error(`Fyldo: form "${form}" has no field "${id}".`);
    const own = f ? KIND_OF[f.type] : undefined;
    if (kind !== undefined && own !== undefined && own !== kind) console.error(`Fyldo: field "${id}" of form "${form}" is a ${f!.type} field, bound as "${kind}" (its kind is "${own}").`);
    const as = kind ?? own;
    const disabled = Boolean(f?.disabled) || loading;
    const value = values[id] ?? null;
    if (as === 'toggle') return { checked: value === true, onCheckedChange: (next: boolean) => controller.setValue(id, next), disabled };
    const onBlur = (): void => void controller.validateField(id);
    if (as === 'media') {
      return {
        value: typeof value === 'number' ? value : 0,
        media: mediaItem(state.media[id]),
        onValueChange: (next: number, item: MediaItem | null) => controller.setValue(id, next, item),
        onBlur,
        disabled,
      };
    }
    const set = (next: FieldValue): void => controller.setValue(id, next);
    // Only a kind asked for is coerced to its control's type: `field(id)` gives the stored value as it is.
    switch (kind) {
      case 'text':
        return { value: typeof value === 'string' ? value : '', onValueChange: set, onBlur, disabled };
      case 'number':
        return { value: typeof value === 'number' || typeof value === 'string' ? value : '', onValueChange: set, onBlur, disabled };
      case 'list':
        return { value: asList(value), onValueChange: set, onBlur, disabled };
      case 'range':
        return { value: asRange(value), onValueChange: set, onBlur, disabled };
    }
    return { value, onValueChange: set, onBlur, disabled };
  };
  const field = bind as RecordFormApi['field'];

  return {
    status: load.status,
    values,
    errors: state.errors,
    error: (path) => state.errors[path],
    errorCount: (path) => Object.keys(state.errors).filter((key) => belongsTo(key, path)).length,
    dirty: controller.dirty.length > 0,
    saving: scopeState(state, PAGE_SCOPE).status === 'saving',
    invalidSaves: state.reveal,
    set: (id, value, options) => controller.setValue(id, value, undefined, options?.clear),
    field,
    validate: (id, path) => controller.validateField(id, path),
    save: () => controller.save(),
    discard: controller.discard,
    Frame,
  };
}
