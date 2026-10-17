import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react';
import { __ } from '../../i18n';
import { Spinner } from '../../icons/Spinner';
import { ApiError, LOGGED_OUT, type RecordsApi } from '../../lib/api';
import { useDirtyScope } from '../../lib/dirty';
import { useFormHost } from '../../lib/host';
import { createFormStore, useForm, type FormShape, type FormSource } from '../../lib/page-form';
import type { RelationSearch } from '../../lib/relation';
import type { FieldValue, FormDef } from '../../types';
import { Button } from '../ui/button';
import { Notice } from '../ui/notice';
import { FormBody } from './FormBody';

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
  useEffect(() => {
    if (!host) console.error('Fyldo: a <Form> works only inside Fyldo’s admin screen (a custom page).');
    else if (!def) console.error(`Fyldo: there is no form "${form}": register it in PHP.`);
  }, [host, def, form]);

  if (!host || !def) {
    return (
      <Notice className="fy:mt-6" tone="red">
        {__('This form couldn’t be loaded.', 'fyldo')}
      </Notice>
    );
  }
  // Another form is another state: start over. A key may come as a number from plain JavaScript: keys are compared as text.
  return <RecordForm key={def.id} def={def} api={host.api} locale={host.locale} record={String(record)} onSaved={onSaved} />;
}

interface RecordFormProps extends Omit<FormProps, 'form'> {
  def: FormDef;
  api: RecordsApi;
  locale: string;
}

function RecordForm({ def, api, locale, record, onSaved }: RecordFormProps): ReactElement {
  const [store] = useState(() => createFormStore([]));
  const shape = useMemo<FormShape>(() => ({ id: STATE, save: 'global', sections: def.sections }), [def.sections]);
  // The record the values belong to: `record`, until saving a new one gives it its key.
  const key = useRef<string | null>(null);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const run = useRef(0);
  const container = useRef<HTMLDivElement>(null);
  const saved = useRef(onSaved);
  saved.current = onSaved;
  const current = (): string => key.current ?? record;

  const fetchRecord = useCallback(
    (wanted: string) => {
      const id = ++run.current;
      setLoad({ status: 'loading' });
      api.readRecord(def.id, wanted).then(
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
          if (!(error instanceof ApiError) || error.status !== 0) console.error(`Fyldo: loading record "${wanted}" of form "${def.id}" failed.`, error);
          setLoad({
            status: 'failed',
            message: error instanceof ApiError && error.code === LOGGED_OUT ? error.message : __('Couldn’t load this item. Check your connection and try again.', 'fyldo'),
          });
        },
      );
    },
    [api, def.id, store],
  );

  // A new `record` loads it — unless it is the key a save just gave the new record: those values are already here.
  useEffect(() => {
    if (key.current === record) return;
    key.current = record;
    store.dispatch(STATE, { type: 'reloaded', values: {}, revision: '' }); // the defaults while it loads
    fetchRecord(record);
  }, [record, fetchRecord, store]);

  const source = useMemo<FormSource>(
    () => ({
      save: async (values, revision) => {
        const result = await api.saveRecord(def.id, key.current ?? NEW_RECORD, values, revision);
        if (result.key) key.current = result.key;
        return result;
      },
      read: () => api.readRecord(def.id, key.current ?? NEW_RECORD),
    }),
    [api, def.id],
  );
  const search = useMemo<RelationSearch>(() => (path, query, signal) => api.searchRecordItems(def.id, path, query, signal), [api, def.id]);

  const controller = useForm(shape, source, store, {
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
          <Button variant="secondary" size="sm" onClick={() => fetchRecord(current())}>
            {__('Retry', 'fyldo')}
          </Button>
        }
      >
        {load.message}
      </Notice>
    );
  }

  const loading = load.status === 'loading';
  return (
    <div ref={container} data-slot="fy-form" data-form={def.id} className="fy:relative fy:flex fy:flex-col">
      {/* Over the first card's header (at its end, inside its padding), so the cards never move when the values arrive. */}
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
      <FormBody form={shape} controller={controller} container={container} search={search} locale={locale} kind="record" busy={loading} />
    </div>
  );
}
