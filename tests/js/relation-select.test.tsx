import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FieldRenderer } from '../../app/components/fyldo/FieldRenderer';
import { FieldShell } from '../../app/components/ui/field-shell';
import { TooltipProvider } from '../../app/components/ui/tooltip';
import { RelationSelect } from '../../app/components/ui/relation-select';
import type { ItemsQuery, ItemsResult } from '../../app/lib/api';
import { PortalContainerContext } from '../../app/lib/portal';
import { RelationSearchContext } from '../../app/lib/relation';
import type { FieldValue, GroupFieldDef, GroupItemValue, RelationItem } from '../../app/types';

const PAGES: RelationItem[] = [
  { value: 3, label: 'Home', hint: '' },
  { value: 7, label: 'About us', hint: '' },
  { value: 9, label: 'Contact', hint: '' },
  { value: 12, label: 'Summer sale', hint: 'Page' },
];

/** A server with PAGES: `include` returns those IDs, a search filters by title, two results per page. */
function server(fail = false) {
  return vi.fn(async (_path: string, query: ItemsQuery): Promise<ItemsResult> => {
    if (fail) throw new Error('offline');
    if (query.include) return { items: PAGES.filter((p) => query.include!.includes(p.value)), more: false };
    const hits = PAGES.filter((p) => p.label.toLowerCase().includes((query.search ?? '').toLowerCase()));
    const page = query.page ?? 1;
    return { items: hits.slice((page - 1) * 2, page * 2), more: hits.length > page * 2 };
  });
}

function Harness({ initial, multiple = false, known = [], search, onChange }: { initial: number | number[]; multiple?: boolean; known?: RelationItem[]; search: ReturnType<typeof server>; onChange?: (v: number | number[], items: RelationItem[]) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <FieldShell label="Homepage">
      <RelationSelect
        value={value}
        multiple={multiple}
        known={known}
        search={search}
        path="homepage"
        placeholder="Select a page…"
        aria-label="Homepage"
        onValueChange={(next, items) => {
          setValue(next);
          onChange?.(next, items);
        }}
      />
    </FieldShell>
  );
}

function setup(props: Parameters<typeof Harness>[0]) {
  const root = document.createElement('div');
  document.body.append(root);
  const onChange = vi.fn();
  render(
    <PortalContainerContext.Provider value={root}>
      <Harness onChange={onChange} {...props} />
    </PortalContainerContext.Provider>,
  );
  return { onChange, field: () => screen.getByRole('combobox', { name: 'Homepage' }) };
}

async function openPopup(field: HTMLElement) {
  await userEvent.click(field);
  const dialog = await screen.findByRole('dialog');
  const search = within(dialog).getByRole('combobox', { name: 'Search options' }) as HTMLInputElement;
  await waitFor(() => expect(search).toHaveFocus());
  return { dialog, search };
}

describe('RelationSelect', () => {
  it('lists the first page when it opens, searches as the user types, and picks one item', async () => {
    const search = server();
    const { field, onChange } = setup({ initial: 0, search });
    expect(field()).toHaveTextContent('Select a page…');

    const { dialog, search: box } = await openPopup(field());
    await within(dialog).findByRole('option', { name: 'Home' });
    expect(search).toHaveBeenCalledWith('homepage', { search: '', page: 1 }, expect.any(AbortSignal));

    await userEvent.type(box, 'sale');
    const option = await within(dialog).findByRole('option', { name: 'Summer sale · Page' });
    expect(search).toHaveBeenLastCalledWith('homepage', { search: 'sale', page: 1 }, expect.any(AbortSignal));

    await userEvent.click(option);
    expect(onChange).toHaveBeenLastCalledWith(12, [PAGES[3]]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(field()).toHaveTextContent('Summer sale · Page');

    // Backspace on the closed field clears one value.
    field().focus();
    await userEvent.keyboard('{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith(0, []);
  });

  it('shows "No results found." when nothing matches', async () => {
    const { field } = setup({ initial: 0, search: server() });
    const { dialog, search } = await openPopup(field());
    await userEvent.type(search, 'zzz');
    expect(await within(dialog).findByText('No results found.')).toBeInTheDocument();
  });

  it('offers Retry when a request fails, and sends it again', async () => {
    const failing = server(true);
    const { field } = setup({ initial: 0, search: failing });
    await userEvent.click(field());
    const errorRow = await screen.findByRole('alert');
    expect(errorRow).toHaveTextContent('Couldn’t load results.');
    await userEvent.click(within(errorRow).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(failing).toHaveBeenCalledTimes(2));
  });

  it('fetches the titles of a saved value it has none for', async () => {
    const search = server();
    const { field } = setup({ initial: [7, 3], multiple: true, search });

    await waitFor(() => expect([...field().querySelectorAll('[data-slot=fy-tag]')].map((t) => t.textContent)).toEqual(['About us', 'Home']));
    expect(search).toHaveBeenCalledWith('homepage', { include: [7, 3] });
  });

  it('with multiple, toggles items in pick order and removes the last tag with Backspace', async () => {
    const search = server();
    const { field, onChange } = setup({ initial: [9], multiple: true, known: [PAGES[2]!], search });
    expect(search).not.toHaveBeenCalled(); // the page knew the title

    const { dialog, search: box } = await openPopup(field());
    await userEvent.click(await within(dialog).findByRole('option', { name: 'About us' }));
    expect(onChange).toHaveBeenLastCalledWith([9, 7], [PAGES[2], PAGES[1]]);
    expect(within(dialog).getByText('2 selected')).toBeInTheDocument();

    box.focus();
    await userEvent.keyboard('{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith([9], [PAGES[2]]);
  });

  it('in a group whose `item_title` is a post sub-field, each item is named after its chosen post, without typing', async () => {
    const search = server();
    const group: GroupFieldDef = {
      id: 'promos',
      type: 'group',
      label: 'Promotions',
      description: '',
      default: [],
      disabled: false,
      layout: 'stacked',
      validate: {},
      item_title: 'target',
      item_icon: '',
      sortable: false,
      addable: true,
      min: null,
      max: null,
      add_label: '',
      fields: [
        { id: 'target', type: 'post', label: 'Links to', description: '', default: 0, disabled: false, layout: 'field', validate: { relation: true }, multiple: false, placeholder: 'Select a page…' },
      ],
    };
    function Page() {
      const [value, setValue] = useState<FieldValue>([{ target: 7 }, { target: 0 }]);
      return <FieldRenderer field={group} value={value} divider={false} onChange={(_id, next) => setValue(next)} onGroupChange={(_id, next: GroupItemValue[]) => setValue(next)} onBlur={() => undefined} />;
    }
    const root = document.createElement('div');
    document.body.append(root);
    render(
      <PortalContainerContext.Provider value={root}>
        <TooltipProvider>
          <RelationSearchContext.Provider value={search}>
            <Page />
          </RelationSearchContext.Provider>
        </TooltipProvider>
      </PortalContainerContext.Provider>,
    );
    const titles = () => [...document.querySelectorAll('[data-slot=fy-group-item-title]')].map((t) => t.textContent);

    // the saved item is collapsed: its title is looked up by ID; the empty one keeps "Item 2"
    await waitFor(() => expect(titles()).toEqual(['About us', 'Item 2']));
    expect(search).toHaveBeenCalledWith('promos.target', { include: [7] });
    expect(search.mock.calls.filter(([, q]) => q.include).length, 'one lookup for the header and the select together').toBe(1);

    // picking a page in the second item names it at once
    await userEvent.click(screen.getAllByRole('button', { name: /Item 2/ })[0]!);
    const { dialog, search: box } = await openPopup(screen.getByRole('combobox', { name: 'Links to' }));
    await userEvent.type(box, 'sale');
    await userEvent.click(await within(dialog).findByRole('option', { name: 'Summer sale · Page' }));
    await waitFor(() => expect(titles()).toEqual(['About us', 'Summer sale · Page']));
  });
});
