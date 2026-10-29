/**
 * `useForm` (the SDK's headless record form): the page draws the fields, Fyldo loads, checks and saves — the same engine
 * as `<Form>`. Bindings by field type, a value drawn only by the page (`'module' => false`), errors at paths inside a
 * value (422), focus on the first invalid control, the Save Bar, and what `Form` does with a field it cannot draw.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Form, useRecordForm, type FormProps, type FormApi } from '../../app/components/fyldo/Form';
import { SectionCard } from '../../app/components/fyldo/SectionCard';
import { SettingRow } from '../../app/components/fyldo/SettingRow';
import { Input } from '../../app/components/ui/input';
import { Toggle } from '../../app/components/ui/toggle';
import { ApiError, type RecordResult, type RecordsApi } from '../../app/lib/api';
import { FormHostContext } from '../../app/lib/host';
import { PortalContainerContext } from '../../app/lib/portal';
import { sdk } from '../../app/lib/sdk';
import type { CustomFieldDef, FieldDef, FieldValue, FormDef, MediaItem, PageDef } from '../../app/types';

const page = JSON.parse(readFileSync(resolve(__dirname, '../fixtures/slice-page.client.json'), 'utf8')) as PageDef;
const [siteTitle, , maintenance] = page.sections[0]!.fields as [FieldDef, FieldDef, FieldDef];
const slidesField: CustomFieldDef = { id: 'slides', type: 'custom', label: 'Slides', description: '', default: [], disabled: false, layout: 'field', validate: {}, module: '', props: {} };

/** A field of each kind `field(id, kind)` binds, built by hand: only what the bindings read. */
const kindField = (id: string, type: string, value: FieldValue): FieldDef =>
  ({ id, type, label: id, description: '', default: value, disabled: false, layout: 'field', validate: {} }) as unknown as FieldDef;
const kindFields = [
  kindField('title', 'text', ''),
  kindField('count', 'number', ''),
  kindField('tags', 'multi_select', []),
  kindField('when', 'date_range', { start: '', end: '' }),
  kindField('pinned', 'toggle', false),
  kindField('cover', 'image', 0),
  { ...slidesField, id: 'extra' },
];

const forms: FormDef[] = [
  { id: 'kinds', sections: [{ id: 'all', tab: '', title: 'All', description: '', tone: 'default', fields: kindFields }] },
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

describe('useForm field(id, kind)', () => {
  /** Hands the form's API to the test, as a page's own component would use it. */
  function probe(stored: Record<string, FieldValue>) {
    const form: { current?: FormApi } = {};
    function Probe() {
      form.current = useRecordForm({ form: 'kinds', record: '7' });
      return <form.current.Frame />;
    }
    const cover: MediaItem = { id: 12, filename: 'cover.jpg', filesize: 0, mime: 'image/jpeg', extension: 'jpg', width: 800, height: 600, thumbnail: null };
    setup({ readRecord: async () => ({ key: '7', values: stored, revision: 'r1', media: { cover } }) }, <Probe />);
    return form as { current: FormApi };
  }

  it('gives each kind its control’s value type, whatever the record stores', async () => {
    const form = probe({ title: 7, count: null, tags: ['a', 3, 'b'], when: { start: '2026-01-02' }, pinned: 'yes', cover: 12, extra: 'x' });
    await waitFor(() => expect(form.current.status).toBe('ready'));

    expect(form.current.field('title', 'text')).toMatchObject({ value: '', disabled: false });
    expect(form.current.field('count', 'number').value).toBe('');
    expect(form.current.field('tags', 'list').value).toEqual(['a', 'b']);
    expect(form.current.field('when', 'range').value).toEqual({ start: '2026-01-02', end: '' });
    expect(form.current.field('pinned', 'toggle')).toEqual({ checked: false, onCheckedChange: expect.any(Function), disabled: false });
    expect(form.current.field('cover', 'media')).toMatchObject({ value: 12, media: { id: 12, filename: 'cover.jpg' } });
    // A value only the page draws binds as any kind.
    expect(form.current.field('extra', 'text').value).toBe('x');
    expect(form.current.field('extra', 'list').value).toEqual([]);
    // `field(id)` is unchanged: the stored value as it is.
    expect(form.current.field('title')).toMatchObject({ value: 7 });
    expect(form.current.field('tags')).toMatchObject({ value: ['a', 3, 'b'] });
  });

  it('keeps a value of the right type, and sets and checks the field like field(id)', async () => {
    const form = probe({ title: 'Breakfast', count: 3, tags: ['a'], when: { start: '2026-01-02', end: '2026-01-09' }, pinned: true, cover: 0, extra: null });
    await waitFor(() => expect(form.current.status).toBe('ready'));
    expect(form.current.field('title', 'text').value).toBe('Breakfast');
    expect(form.current.field('count', 'number').value).toBe(3);
    expect(form.current.field('pinned', 'toggle').checked).toBe(true);
    expect(form.current.field('cover', 'media').value).toBe(0);

    act(() => form.current.field('title', 'text').onValueChange('Lunch'));
    act(() => form.current.field('tags', 'list').onValueChange(['a', 'c']));
    act(() => form.current.field('when', 'range').onValueChange({ start: '', end: '' }));
    act(() => form.current.field('pinned', 'toggle').onCheckedChange(false));
    expect(form.current.values).toMatchObject({ title: 'Lunch', tags: ['a', 'c'], when: { start: '', end: '' }, pinned: false });
    expect(form.current.dirty).toBe(true);
  });

  it('reports a kind that does not match the field’s type, and still binds that kind', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const form = probe({ title: 'Breakfast', count: 3, tags: [], when: { start: '', end: '' }, pinned: false, cover: 0, extra: null });
    await waitFor(() => expect(form.current.status).toBe('ready'));
    error.mockClear();

    expect(form.current.field('title', 'toggle')).toMatchObject({ checked: false });
    expect(error).toHaveBeenCalledWith('Fyldo: field "title" of form "kinds" is a text field, bound as "toggle" (its kind is "text").');
    error.mockClear();
    form.current.field('title', 'text');
    form.current.field('extra', 'range');
    expect(error).not.toHaveBeenCalled();
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

describe('useForm validate(path?)', () => {
  /** The story form's API, with Editor's controls drawn. */
  function probe(api: Partial<RecordsApi> = {}) {
    const form: { current?: FormApi } = {};
    function Probe() {
      form.current = useRecordForm({ form: 'story', record: '42' });
      return <form.current.Frame />;
    }
    setup(api, <Probe />);
    return form as { current: FormApi };
  }

  it('checks one field by its id, or every field without a path', async () => {
    const form = probe();
    await waitFor(() => expect(form.current.status).toBe('ready'));

    act(() => form.current.set('title', ''));
    expect(form.current.error('title')).toBeUndefined();
    let valid = true;
    act(() => void (valid = form.current.validate()));
    expect(valid).toBe(false);
    expect(form.current.error('title')).toBe('This field is required.');

    act(() => form.current.set('title', 'Lunch', { clear: [] }));
    act(() => void (valid = form.current.validate('title')));
    expect(valid).toBe(true);
    expect(form.current.error('title')).toBeUndefined();
  });

  it('a path inside a value checks only the messages at or under it', async () => {
    const form = probe({
      saveRecord: async () =>
        Promise.reject(new ApiError('Some values are not valid.', 422, 'fyldo_invalid', { 'slides.0.link': 'Enter a full URL.', 'slides.1.link': 'Enter a full URL.' })),
    });
    await waitFor(() => expect(form.current.status).toBe('ready'));
    act(() => form.current.set('title', 'Lunch'));
    await act(() => form.current.save());
    expect(form.current.errorCount('slides')).toBe(2);

    let valid = false;
    act(() => void (valid = form.current.validate('slides.1')));
    expect(valid).toBe(true);
    expect(form.current.error('slides.1.link')).toBeUndefined();
    expect(form.current.error('slides.0.link')).toBe('Enter a full URL.');
  });
});
