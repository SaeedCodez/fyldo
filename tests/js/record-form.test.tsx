/**
 * `<Form>` (the SDK's `Form`): a plugin's record form drawn by the settings page machinery — load, edit, save as a whole,
 * 422 errors on the fields, the 409 conflict, creating a record (`new` → its key, no reload), load failures and 404.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Form } from '../../app/components/fyldo/Form';
import { ApiError, type RecordResult, type RecordsApi } from '../../app/lib/api';
import { FormHostContext } from '../../app/lib/host';
import { PortalContainerContext } from '../../app/lib/portal';
import type { FieldDef, FieldValue, FormDef, PageDef } from '../../app/types';

const fixture = (name: string) => JSON.parse(readFileSync(resolve(__dirname, `../fixtures/${name}.client.json`), 'utf8')) as PageDef;
const page = fixture('slice-page');
const related = fixture('form-fields-page')
  .sections.flatMap((s) => s.fields)
  .find((f) => f.id === 'related_pages') as FieldDef;

const forms: FormDef[] = [
  { id: 'announcement', sections: page.sections },
  { id: 'linked', sections: [{ id: 'links', tab: '', title: 'Links', description: '', tone: 'default', fields: [related] }] },
];
const stored: RecordResult = { key: '42', values: page.values, revision: 'r1' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(api: Partial<RecordsApi> = {}, ui = <Form form="announcement" record="42" />) {
  const records: RecordsApi = {
    readRecord: vi.fn(api.readRecord ?? (async () => stored)),
    saveRecord: vi.fn(api.saveRecord ?? (async (_form: string, key: string, values: Record<string, FieldValue>) => ({ key: key === 'new' ? '43' : key, values: { ...page.values, ...values }, revision: 'r2' }))),
    searchRecordItems: vi.fn(api.searchRecordItems ?? (async () => ({ items: [], more: false }))),
  };
  const root = document.createElement('div');
  document.body.append(root);
  render(
    <PortalContainerContext.Provider value={root}>
      <FormHostContext.Provider value={{ forms, api: records, locale: 'en' }}>{ui}</FormHostContext.Provider>
    </PortalContainerContext.Provider>,
  );
  return records;
}

const title = () => screen.getByRole('textbox', { name: 'Site title' });
const bar = () => screen.getByRole('region', { name: 'Unsaved changes' });

afterEach(() => {
  document.body.replaceChildren();
});

describe('Form: loading a record', () => {
  it('shows a loading status over the cards (already in place, inert), then the values', async () => {
    const answer = deferred<RecordResult>();
    const api = setup({ readRecord: () => answer.promise });

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    const card = screen.getByRole('region', { name: 'Site identity' });
    expect(card.closest('[inert]')).toHaveAttribute('aria-busy', 'true');
    expect(api.readRecord).toHaveBeenCalledWith('announcement', '42');

    answer.resolve(stored);
    await waitFor(() => expect(title()).toHaveValue('Fyldo'));
    expect(screen.getByRole('status')).toHaveTextContent('');
    expect(card.closest('[inert]')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull();
  });

  it('a failed load says so with Retry, which loads again', async () => {
    const api = setup({ readRecord: vi.fn().mockRejectedValueOnce(new ApiError('network', 0, 'fyldo_network')).mockResolvedValueOnce(stored) });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Couldn’t load this item. Check your connection and try again.');

    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(title()).toHaveValue('Fyldo'));
    expect(api.readRecord).toHaveBeenCalledTimes(2);
  });

  it('a record that does not exist (404) says so', async () => {
    setup({ readRecord: async () => Promise.reject(new ApiError('No such record.', 404, 'fyldo_not_found')) });
    expect(await screen.findByRole('alert')).toHaveTextContent('This item doesn’t exist. It may have been deleted.');
    expect(screen.queryByRole('region', { name: 'Site identity' })).toBeNull();
  });

  it('an unknown form is reported, not drawn', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setup({}, <Form form="nope" record="1" />);
    expect(screen.getByText('This form couldn’t be loaded.')).toBeVisible();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('there is no form "nope"'));
    error.mockRestore();
  });
});

describe('Form: saving', () => {
  it('saves the record as a whole with its revision; the Save Bar says Saved; onSaved gets the key and values', async () => {
    const onSaved = vi.fn();
    const api = setup({}, <Form form="announcement" record="42" onSaved={onSaved} />);
    await waitFor(() => expect(title()).toHaveValue('Fyldo'));

    await userEvent.type(title(), '!');
    expect(within(bar()).getByText('You have unsaved changes')).toBeVisible();
    await userEvent.click(within(bar()).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('All changes saved')).toBeVisible();
    expect(api.saveRecord).toHaveBeenCalledWith('announcement', '42', { ...page.values, site_title: 'Fyldo!' }, 'r1');
    expect(onSaved).toHaveBeenCalledWith('42', { ...page.values, site_title: 'Fyldo!' });
  });

  it('Ctrl+S saves; Discard restores the stored values', async () => {
    const api = setup();
    await waitFor(() => expect(title()).toHaveValue('Fyldo'));
    await userEvent.type(title(), '?');
    await userEvent.click(within(bar()).getByRole('button', { name: 'Discard' }));
    expect(title()).toHaveValue('Fyldo');

    await userEvent.type(title(), '?');
    await userEvent.keyboard('{Control>}s{/Control}');
    await waitFor(() => expect(api.saveRecord).toHaveBeenCalledTimes(1));
  });

  it('422: the server’s messages go under their fields, and focus moves to the first one', async () => {
    setup({ saveRecord: async () => Promise.reject(new ApiError('Some values are not valid.', 422, 'fyldo_invalid', { tagline: 'Too short.' })) });
    await waitFor(() => expect(title()).toHaveValue('Fyldo'));
    await userEvent.type(title(), '!');
    await userEvent.click(within(bar()).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Too short.')).toBeVisible();
    expect(within(bar()).getByText('Couldn’t save. Check the highlighted fields.')).toBeVisible();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Tagline' })).toHaveFocus());
  });

  it('checks every field before sending, not only the changed ones', async () => {
    const api = setup({ readRecord: async () => ({ ...stored, values: { ...page.values, site_title: '' } }) });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Tagline' })).toHaveValue(page.values.tagline as string));
    await userEvent.type(screen.getByRole('textbox', { name: 'Tagline' }), '!');
    await userEvent.click(within(bar()).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(title()).toHaveFocus()); // the required, empty title
    expect(title()).toHaveAttribute('aria-invalid', 'true');
    expect(api.saveRecord).not.toHaveBeenCalled();
  });

  it('409: the edits stay, the conflict Notice offers to reload the latest values', async () => {
    const api = setup({
      readRecord: vi.fn().mockResolvedValueOnce(stored).mockResolvedValueOnce({ ...stored, values: { ...page.values, site_title: 'Theirs' }, revision: 'r9' }),
      saveRecord: async () => Promise.reject(new ApiError('changed', 409, 'fyldo_conflict')),
    });
    await waitFor(() => expect(title()).toHaveValue('Fyldo'));
    await userEvent.type(title(), '!');
    await userEvent.click(within(bar()).getByRole('button', { name: 'Save changes' }));

    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('This item was changed somewhere else');
    expect(within(bar()).getByText('Couldn’t save: this item was changed somewhere else.')).toBeVisible();
    expect(title()).toHaveValue('Fyldo!');

    await userEvent.click(within(notice).getByRole('button', { name: 'Reload latest values' }));
    await waitFor(() => expect(title()).toHaveValue('Theirs'));
    expect(api.readRecord).toHaveBeenLastCalledWith('announcement', '42');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Form: a new record', () => {
  /** What a plugin does: show the new record's key once it exists. */
  function Editor({ onKey }: { onKey: (key: string) => void }) {
    const [record, setRecord] = useState('new');
    return (
      <Form
        form="announcement"
        record={record}
        onSaved={(key) => {
          onKey(key);
          setRecord(key);
        }}
      />
    );
  }

  it('the first save creates it (no revision); the key comes back and the Form keeps its state (no reload); the next save updates it', async () => {
    const onKey = vi.fn();
    const api = setup({ readRecord: async () => ({ key: '', values: { ...page.values, site_title: '' }, revision: '' }) }, <Editor onKey={onKey} />);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Tagline' })).toHaveValue(page.values.tagline as string));
    expect(api.readRecord).toHaveBeenCalledWith('announcement', 'new');

    await userEvent.type(title(), 'Hello');
    await userEvent.click(within(bar()).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('All changes saved')).toBeVisible();
    expect(api.saveRecord).toHaveBeenCalledWith('announcement', 'new', { ...page.values, site_title: 'Hello' }, '');
    expect(onKey).toHaveBeenCalledWith('43');
    expect(api.readRecord).toHaveBeenCalledTimes(1);
    expect(title()).toHaveValue('Hello');

    await userEvent.type(title(), '!');
    await userEvent.click(within(bar()).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.saveRecord).toHaveBeenLastCalledWith('announcement', '43', { ...page.values, site_title: 'Hello!' }, 'r2'));
    expect(api.readRecord).toHaveBeenCalledTimes(1);
  });

  it('another record loads its own values', async () => {
    function Switcher() {
      const [record, setRecord] = useState('42');
      return (
        <>
          <button type="button" onClick={() => setRecord('7')}>
            Open 7
          </button>
          <Form form="announcement" record={record} />
        </>
      );
    }
    const api = setup({ readRecord: async (_form, key) => ({ ...stored, key, values: { ...page.values, site_title: `Record ${key}` } }) }, <Switcher />);
    await waitFor(() => expect(title()).toHaveValue('Record 42'));
    await userEvent.click(screen.getByRole('button', { name: 'Open 7' }));
    await waitFor(() => expect(title()).toHaveValue('Record 7'));
    expect(api.readRecord).toHaveBeenLastCalledWith('announcement', '7');
  });
});

describe('Form: relation fields', () => {
  it('search through the form’s own route', async () => {
    const api = setup({ readRecord: async () => ({ key: '1', values: { related_pages: [] }, revision: 'r1' }) }, <Form form="linked" record="1" />);
    const combobox = await screen.findByRole('combobox', { name: 'Related pages' });
    await waitFor(() => expect(combobox.closest('[inert]')).toBeNull());
    await userEvent.click(combobox);
    await waitFor(() => expect(api.searchRecordItems).toHaveBeenCalledWith('linked', 'related_pages', expect.objectContaining({ search: '' }), expect.anything()));
  });
});
