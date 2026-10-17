/**
 * `useForm` (the SDK's headless record form): the page draws the fields, Fyldo loads, checks and saves — the same engine
 * as `<Form>`. Bindings by field type, a value drawn only by the page (`'module' => false`), errors at paths inside a
 * value (422), focus on the first invalid control, the Save Bar, and what `Form` does with a field it cannot draw.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Form, useRecordForm, type FormProps } from '../../app/components/fyldo/Form';
import { SectionCard } from '../../app/components/fyldo/SectionCard';
import { SettingRow } from '../../app/components/fyldo/SettingRow';
import { Input } from '../../app/components/ui/input';
import { Toggle } from '../../app/components/ui/toggle';
import { ApiError, type RecordResult, type RecordsApi } from '../../app/lib/api';
import { FormHostContext } from '../../app/lib/host';
import { PortalContainerContext } from '../../app/lib/portal';
import { sdk } from '../../app/lib/sdk';
import type { CustomFieldDef, FieldDef, FieldValue, FormDef, PageDef } from '../../app/types';

const page = JSON.parse(readFileSync(resolve(__dirname, '../fixtures/slice-page.client.json'), 'utf8')) as PageDef;
const [siteTitle, , maintenance] = page.sections[0]!.fields as [FieldDef, FieldDef, FieldDef];
const slidesField: CustomFieldDef = { id: 'slides', type: 'custom', label: 'Slides', description: '', default: [], disabled: false, layout: 'field', validate: {}, module: '', props: {} };

const forms: FormDef[] = [
  {
    id: 'story',
    sections: [
      { id: 'info', tab: '', title: 'Story', description: '', tone: 'default', fields: [{ ...siteTitle, id: 'title', label: 'Title' } as FieldDef, { ...maintenance, id: 'pinned', label: 'Pinned' } as FieldDef] },
      { id: 'content', tab: '', title: 'Slides', description: '', tone: 'default', fields: [slidesField] },
    ],
  },
];

type Slide = { title: string; link: string };
const values = { title: 'Breakfast', pinned: false, slides: [{ title: 'One', link: 'https://example.com/1' }, { title: 'Two', link: 'https://example.com/2' }] };
const stored: RecordResult = { key: '42', values, revision: 'r1' };

/** A page that draws the record itself: two rows from bindings, the slides from the value, and a live preview. */
function Editor(props: Partial<FormProps>) {
  const form = useRecordForm({ form: 'story', record: '42', ...props });
  const slides = (form.values.slides ?? []) as Slide[];
  return (
    <form.Frame>
      <SectionCard title="Story">
        <SettingRow title="Title" error={form.error('title')}>
          <Input size="md" {...(form.field('title') as { value: string })} />
        </SettingRow>
        <SettingRow title="Pinned" layout="inline" divider={false}>
          <Toggle {...(form.field('pinned') as { checked: boolean })} />
        </SettingRow>
      </SectionCard>
      <SectionCard title="Slides">
        {slides.map((slide, i) => (
          <SettingRow key={i} title={`Link ${i + 1}`} error={form.error(`slides.${i}.link`)}>
            <Input
              size="md"
              value={slide.link}
              onValueChange={(link: string) => form.set('slides', slides.map((s, j) => (j === i ? { ...s, link } : s)), { clear: [`slides.${i}.link`] })}
            />
          </SettingRow>
        ))}
        <p data-testid="preview">
          {String(form.values.title)} · {slides.length} slides · {form.errorCount('slides')} errors · {form.invalidSaves} refused
        </p>
      </SectionCard>
    </form.Frame>
  );
}

function setup(api: Partial<RecordsApi> = {}, ui = <Editor />) {
  const records: RecordsApi = {
    readRecord: vi.fn(api.readRecord ?? (async () => stored)),
    saveRecord: vi.fn(api.saveRecord ?? (async (_form: string, key: string, sent: Record<string, FieldValue>) => ({ key: key === 'new' ? '43' : key, values: { ...values, ...sent }, revision: 'r2' }))),
    searchRecordItems: vi.fn(async () => ({ items: [], more: false })),
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

const title = () => screen.getByRole('textbox', { name: 'Title' });
const preview = () => screen.getByTestId('preview');
const bar = () => screen.getByRole('region', { name: 'Unsaved changes' });

afterEach(() => {
  document.body.replaceChildren();
});

describe('useForm', () => {
  it('is the SDK’s useForm', () => {
    expect(sdk.useForm).toBe(useRecordForm);
  });

  it('gives the defaults while the record loads (inert, with a status), then its values', async () => {
    let answer!: (result: RecordResult) => void;
    setup({ readRecord: () => new Promise<RecordResult>((r) => (answer = r)) });

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(title()).toHaveValue('Fyldo'); // the field's default
    expect(title().closest('[inert]')).toHaveAttribute('aria-busy', 'true');

    answer(stored);
    await waitFor(() => expect(title()).toHaveValue('Breakfast'));
    expect(preview()).toHaveTextContent('Breakfast · 2 slides · 0 errors');
    expect(title().closest('[inert]')).toBeNull();
  });

  it('edits through the bindings and the page’s own controls, then saves the record as a whole', async () => {
    const onSaved = vi.fn();
    const api = setup({}, <Editor onSaved={onSaved} />);
    await waitFor(() => expect(title()).toHaveValue('Breakfast'));

    await userEvent.type(title(), '!');
    expect(preview()).toHaveTextContent('Breakfast! · 2 slides'); // the preview reads the edit at once
    await userEvent.click(screen.getByRole('switch', { name: 'Pinned' }));
    await userEvent.clear(screen.getByRole('textbox', { name: 'Link 2' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Link 2' }), 'https://example.com/b');
    expect(within(bar()).getByText('You have unsaved changes')).toBeVisible();

    await userEvent.click(within(bar()).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('All changes saved')).toBeVisible();
    const sent = { title: 'Breakfast!', pinned: true, slides: [values.slides[0], { title: 'Two', link: 'https://example.com/b' }] };
    expect(api.saveRecord).toHaveBeenCalledWith('story', '42', sent, 'r1');
    expect(onSaved).toHaveBeenCalledWith('42', sent);
  });

  it('refuses an invalid save in the browser and focuses the first invalid control', async () => {
    const api = setup();
    await waitFor(() => expect(title()).toHaveValue('Breakfast'));

    await userEvent.clear(title());
    await userEvent.click(within(bar()).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('This field is required.')).toBeVisible();
    expect(title()).toHaveFocus();
    expect(preview()).toHaveTextContent('1 refused');
    expect(api.saveRecord).not.toHaveBeenCalled();
  });

  it('422: a message at a path inside a value goes under the page’s control for it, counts for the value, and an edit clears it', async () => {
    setup({ saveRecord: async () => Promise.reject(new ApiError('Some values are not valid.', 422, 'fyldo_invalid', { 'slides.1.link': 'Enter a full URL.' })) });
    await waitFor(() => expect(title()).toHaveValue('Breakfast'));
    await userEvent.type(title(), '!');

    await userEvent.keyboard('{Control>}s{/Control}');
    expect(await screen.findByText('Enter a full URL.')).toBeVisible();
    const link = screen.getByRole('textbox', { name: 'Link 2' });
    expect(link).toHaveFocus();
    expect(link).toHaveAccessibleDescription('Enter a full URL.');
    expect(preview()).toHaveTextContent('1 errors');

    await userEvent.type(link, 'x');
    expect(screen.queryByText('Enter a full URL.')).toBeNull();
    expect(preview()).toHaveTextContent('0 errors');
  });

  it('Discard restores the record', async () => {
    setup();
    await waitFor(() => expect(title()).toHaveValue('Breakfast'));
    await userEvent.type(title(), '!');
    await userEvent.click(within(bar()).getByRole('button', { name: 'Discard' }));
    expect(title()).toHaveValue('Breakfast');
  });

  it('a record that does not exist, and an unknown form, are said instead of the fields', async () => {
    setup({ readRecord: async () => Promise.reject(new ApiError('No such record.', 404, 'fyldo_not_found')) });
    expect(await screen.findByRole('alert')).toHaveTextContent('This item doesn’t exist. It may have been deleted.');
    expect(screen.queryByRole('textbox', { name: 'Title' })).toBeNull();
    document.body.replaceChildren();

    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setup({}, <Editor form="nope" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('This form couldn’t be loaded.');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('there is no form "nope"'));
    error.mockRestore();
  });
});

describe('Form with a value only a page draws', () => {
  it('draws the other fields and nothing for it, and keeps it in the saved record', async () => {
    const api = setup({}, <Form form="story" record="42" />);
    await waitFor(() => expect(title()).toHaveValue('Breakfast'));
    expect(screen.queryByRole('group', { name: 'Slides' })).toBeNull();

    await userEvent.type(title(), '!');
    await userEvent.click(within(bar()).getByRole('button', { name: 'Save changes' }));
    await screen.findByText('All changes saved');
    expect(api.saveRecord).toHaveBeenCalledWith('story', '42', { ...values, title: 'Breakfast!' }, 'r1');
  });
});
