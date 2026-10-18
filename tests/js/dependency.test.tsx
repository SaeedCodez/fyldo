/**
 * Conditional display (`dependency`): the shared condition cases (tests/fixtures/dependency-cases.json, also run by
 * PHPUnit), which fields show, and a settings page that shows and hides them live and leaves the hidden ones out of a save.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPage } from '../../app/components/fyldo/SettingsPage';
import { hiddenSubs, holds, visibilityOf } from '../../app/lib/dependency';
import { groupErrors } from '../../app/lib/group';
import { createFormStore } from '../../app/lib/page-form';
import { PortalContainerContext } from '../../app/lib/portal';
import type { DependencyDef, DependencyOperator, FieldValue, GroupFieldDef, PageDef, SectionDef, TextFieldDef, ToggleFieldDef } from '../../app/types';

const { holds: cases } = JSON.parse(readFileSync(resolve(__dirname, '../fixtures/dependency-cases.json'), 'utf8')) as {
  holds: { operator: DependencyOperator; value: unknown; target: unknown; expected: boolean }[];
};

describe('shared condition cases', () => {
  it.each(cases.map((c, i) => [i, c] as const))('#%i', (_, { operator, value, target, expected }) => {
    expect(holds(operator, value, target)).toBe(expected);
  });
});

const when = (field: string, operator: DependencyOperator, value: DependencyDef['conditions'][number]['value'] = null): DependencyDef => ({
  relation: 'and',
  conditions: [{ field, operator, value }],
});

const base = { description: '', disabled: false as const, layout: 'inline' as const, validate: {} };
const toggle = (id: string, label: string, extra: Partial<ToggleFieldDef> = {}): ToggleFieldDef => ({ ...base, id, label, type: 'toggle', default: false, ...extra });
const text = (id: string, label: string, extra: Partial<TextFieldDef> = {}): TextFieldDef => ({ ...base, layout: 'stacked', id, label, type: 'text', default: '', placeholder: '', ...extra });

const sections: SectionDef[] = [
  {
    id: 'main',
    tab: '',
    title: 'Cache',
    description: '',
    tone: 'default',
    fields: [
      toggle('cache', 'Use a cache'),
      toggle('remote', 'Remote server', { dependency: when('cache', '==', true) }),
      text('host', 'Host', { validate: { required: true }, dependency: when('remote', '==', true) }),
      { id: 'tip', type: 'notice', label: '', description: 'A remote cache needs a host.', tone: 'blue', dependency: when('remote', '==', true) },
      text('note', 'Note'),
    ],
  },
  {
    id: 'local',
    tab: '',
    title: 'Local files',
    description: '',
    tone: 'default',
    dependency: { relation: 'and', conditions: [{ field: 'cache', operator: '==', value: true }, { field: 'remote', operator: '!=', value: true }] },
    fields: [text('path', 'Folder', { validate: { required: true } })],
  },
];

describe('visibilityOf', () => {
  it('hides what depends on a hidden field, and the fields of a hidden section', () => {
    const off = visibilityOf(sections, {});
    expect([...off.hidden]).toEqual(['remote', 'host', 'path']);
    expect(off.field('tip')).toBe(false);
    expect(off.field('note')).toBe(true);

    // `remote` stays on while `cache` is off: it is hidden, so `host` (which reads it) is hidden too.
    expect([...visibilityOf(sections, { cache: false, remote: true }).hidden]).toEqual(['remote', 'host', 'path']);
    expect([...visibilityOf(sections, { cache: true }).hidden]).toEqual(['host']);
    expect([...visibilityOf(sections, { cache: true, remote: true }).hidden]).toEqual(['path']);
  });

  it('`or`: one condition is enough', () => {
    const either: SectionDef[] = [{ ...sections[0]!, fields: [toggle('a', 'A'), toggle('b', 'B'), text('c', 'C', { dependency: { relation: 'or', conditions: [{ field: 'a', operator: '==', value: true }, { field: 'b', operator: '==', value: true }] } })] }];
    expect(visibilityOf(either, {}).field('c')).toBe(false);
    expect(visibilityOf(either, { b: true }).field('c')).toBe(true);
  });
});

describe('the unsaved-changes guard', () => {
  it('does not count the edits of a hidden field', () => {
    const store = createFormStore([{ id: 'cache', values: { cache: false, note: '' }, revision: 'r', sections }]);
    store.dispatch('cache', { type: 'change', id: 'path', value: '/tmp', scope: 'page' });
    expect(store.isDirty('cache')).toBe(false); // the Local files card is hidden while the cache is off
    store.dispatch('cache', { type: 'change', id: 'cache', value: true, scope: 'page' });
    expect(store.isDirty('cache')).toBe(true);
  });
});

describe('group sub-fields', () => {
  const links: GroupFieldDef = {
    ...base,
    id: 'links',
    type: 'group',
    label: 'Links',
    layout: 'stacked',
    default: [],
    item_title: '',
    item_icon: '',
    sortable: false,
    addable: true,
    min: null,
    max: null,
    add_label: '',
    fields: [
      toggle('external', 'External'),
      { ...text('url', 'URL', { validate: { required: true } }), type: 'url', dependency: { relation: 'and', conditions: [{ field: 'external', operator: '==', value: true }, { field: 'cache', operator: '==', value: true }] } },
    ],
  };
  const page = visibilityOf([{ ...sections[0]!, fields: [toggle('cache', 'Use a cache'), links] }], { cache: true });

  it('read a sibling of the same item, or a field of the page', () => {
    expect([...hiddenSubs(links, { external: false, url: '' }, page.resolve)]).toEqual(['url']);
    expect([...hiddenSubs(links, { external: true, url: '' }, page.resolve)]).toEqual([]);
    const off = visibilityOf([{ ...sections[0]!, fields: [toggle('cache', 'Use a cache'), links] }], { cache: false });
    expect([...hiddenSubs(links, { external: true, url: '' }, off.resolve)]).toEqual(['url']);
  });

  it('a hidden sub-field is not checked', () => {
    const items = [{ external: false, url: '' }, { external: true, url: '' }];
    expect(Object.keys(groupErrors(links, items, page.resolve))).toEqual(['links.1.url']);
    expect(Object.keys(groupErrors(links, items))).toEqual(['links.0.url', 'links.1.url']); // without the page: every sub-field
  });
});

describe('a settings page', () => {
  const def: PageDef = { id: 'cache', title: 'Cache', description: '', icon: '', group: '', badge: '', save: 'global', tabs: [], sections, values: { cache: false, remote: false, host: 'old.example', note: '', path: '' }, revision: 'rev-1' };

  function renderPage() {
    const root = document.createElement('div');
    document.body.append(root);
    const savePage = vi.fn(async (_id: string, values: Record<string, FieldValue>) => ({ values: { ...def.values, ...values }, revision: 'rev-2' }));
    render(
      <PortalContainerContext.Provider value={root}>
        <SettingsPage page={def} api={{ savePage, readPage: vi.fn(), runAction: vi.fn() }} />
      </PortalContainerContext.Provider>,
    );
    return { savePage };
  }

  it('shows and hides fields, notices and cards as the values change, without a reload', async () => {
    renderPage();
    expect(screen.queryByRole('switch', { name: 'Remote server' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Local files' })).toBeNull();

    await userEvent.click(screen.getByRole('switch', { name: 'Use a cache' }));
    expect(screen.getByRole('switch', { name: 'Remote server' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Local files' })).toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'Host' })).toBeNull();

    await userEvent.click(screen.getByRole('switch', { name: 'Remote server' }));
    expect(screen.getByRole('textbox', { name: 'Host' })).toBeVisible();
    expect(screen.getByText('A remote cache needs a host.')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Local files' })).toBeNull();

    // Off again: everything that hangs on the cache goes, the remote switch included.
    await userEvent.click(screen.getByRole('switch', { name: 'Use a cache' }));
    expect(screen.queryByRole('switch', { name: 'Remote server' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Host' })).toBeNull();
    expect(screen.queryByText('A remote cache needs a host.')).toBeNull();
  });

  it('a hidden field is neither checked nor sent', async () => {
    const { savePage } = renderPage();
    await userEvent.click(screen.getByRole('switch', { name: 'Use a cache' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Remote server' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Note' }), 'hi');

    // The host is required: emptied, the save is refused while it shows.
    await userEvent.clear(screen.getByRole('textbox', { name: 'Host' }));
    const bar = screen.getByRole('region', { name: 'Unsaved changes' });
    await userEvent.click(within(bar).getByRole('button', { name: 'Save changes' }));
    expect(savePage).not.toHaveBeenCalled();
    expect(await screen.findByText('This field is required.')).toBeVisible();

    // Remote off: the host hides (its edit is not sent: the server keeps what is stored), and the Local files card shows.
    await userEvent.click(screen.getByRole('switch', { name: 'Remote server' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Folder' }), '/tmp');
    await userEvent.click(within(screen.getByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(savePage).toHaveBeenCalledWith('cache', { cache: true, note: 'hi', path: '/tmp' }, 'rev-1'));
  });
});
