import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FieldShell } from '../../app/components/ui/field-shell';
import { RelationSelect } from '../../app/components/ui/relation-select';
import type { ItemsQuery, ItemsResult } from '../../app/lib/api';
import { PortalContainerContext } from '../../app/lib/portal';
import type { RelationItem } from '../../app/types';

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
    expect(search).toHaveBeenCalledWith('homepage', { include: [7, 3] }, expect.any(AbortSignal));
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
});
