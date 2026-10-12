/**
 * The `group` field (Figma "Group" + "Group Item"): collapsible items, keyboard reordering (Space, arrows, Escape),
 * Add / Duplicate / Remove with Undo, the `min` / `max` limits, and per-sub-field errors that open their item.
 * The page is tests/fixtures/form-fields-page.php: `header_buttons` (sortable, addable, min 1, max 4).
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPage } from '../../app/components/fyldo/SettingsPage';
import { ToastProvider } from '../../app/components/ui/toast';
import { TooltipProvider } from '../../app/components/ui/tooltip';
import type { Api } from '../../app/lib/api';
import { PortalContainerContext } from '../../app/lib/portal';
import { createToaster } from '../../app/lib/toast';
import type { FieldValue, GroupItemValue, PageDef } from '../../app/types';

const page = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/form-fields-page.client.json'), 'utf8'),
) as PageDef;

function renderPage() {
  const root = document.createElement('div');
  document.body.append(root);
  const savePage = vi.fn<Api['savePage']>(async (_id, values: Record<string, FieldValue>) => ({
    values: { ...page.values, ...values },
    revision: 'rev-2',
  }));
  render(
    <PortalContainerContext.Provider value={root}>
      <TooltipProvider>
        <ToastProvider toaster={createToaster()}>
          <SettingsPage page={page} api={{ savePage, readPage: vi.fn(), runAction: vi.fn() }} />
        </ToastProvider>
      </TooltipProvider>
    </PortalContainerContext.Provider>,
  );
  return { savePage, group: screen.getByRole('group', { name: 'Header buttons' }) };
}

const titles = (group: HTMLElement) =>
  [...group.querySelectorAll('[data-slot=fy-group-item-title]')].map((n) => n.textContent);
const toggle = (group: HTMLElement, title: string) =>
  within(group).getByRole('button', { name: new RegExp(`^${title}`) });
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
const sent = (savePage: ReturnType<typeof renderPage>['savePage']) =>
  savePage.mock.calls.at(-1)?.[1].header_buttons as GroupItemValue[];

describe('group field', () => {
  it('shows each item collapsed with its title, link and icon; the header opens and closes it', async () => {
    const { group } = renderPage();
    expect(titles(group)).toEqual(['Docs', 'Get started']);
    expect(group.querySelector('[data-slot=fy-group-item-summary]')).toHaveTextContent(
      'https://example.com/docs',
    );
    expect(within(group).queryByRole('textbox', { name: 'Label' })).toBeNull();

    const docs = toggle(group, 'Docs');
    expect(docs).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(docs);
    expect(docs).toHaveAttribute('aria-expanded', 'true');
    expect(within(group).getByRole('textbox', { name: 'Label' })).toHaveValue('Docs');
    expect(within(group).getByRole('textbox', { name: 'Link' })).toHaveValue(
      'https://example.com/docs',
    );

    // the title follows the Label sub-field as it is typed
    await userEvent.type(within(group).getByRole('textbox', { name: 'Label' }), ' & guides');
    expect(titles(group)[0]).toBe('Docs & guides');
    await userEvent.click(toggle(group, 'Docs & guides'));
    expect(within(group).queryByRole('textbox', { name: 'Label' })).toBeNull();
  });

  it('moves an item with the keyboard: Space picks it up, an arrow moves it, Space drops it; the order is saved', async () => {
    const { group, savePage } = renderPage();
    const handle = within(group).getByRole('button', { name: 'Reorder Docs' });
    handle.focus();
    await userEvent.keyboard(' ');
    expect(handle).toHaveAttribute('aria-pressed', 'true');
    expect(group.querySelector('[aria-live]')).toHaveTextContent(
      'Docs picked up. Position 1 of 2.',
    );
    await userEvent.keyboard('{ArrowDown}');
    expect(titles(group)).toEqual(['Get started', 'Docs']);
    await waitFor(() =>
      expect(within(group).getByRole('button', { name: 'Reorder Docs' })).toHaveFocus(),
    );
    await userEvent.keyboard(' ');
    expect(group.querySelector('[aria-live]')).toHaveTextContent('Docs dropped. Position 2 of 2.');

    await save();
    expect(sent(savePage).map((item) => item.label)).toEqual(['Get started', 'Docs']);
  });

  it('Escape puts a picked-up item back where it was', async () => {
    const { group } = renderPage();
    within(group).getByRole('button', { name: 'Reorder Docs' }).focus();
    await userEvent.keyboard(' {ArrowDown}');
    expect(titles(group)).toEqual(['Get started', 'Docs']);
    await userEvent.keyboard('{Escape}');
    expect(titles(group)).toEqual(['Docs', 'Get started']);
    expect(group.querySelector('[aria-live]')).toHaveTextContent(
      'Move cancelled. Docs is back at position 1 of 2.',
    );
  });

  it('Add opens a new item at the end and focuses its first sub-field; at the limit Add and Duplicate are disabled and the count says why', async () => {
    const { group } = renderPage();
    expect(within(group).getByText('2 of 4')).toBeInTheDocument();

    await userEvent.click(within(group).getByRole('button', { name: 'Add button' }));
    expect(titles(group)).toEqual(['Docs', 'Get started', 'Item 3']);
    const label = within(group).getByRole('textbox', { name: 'Label' });
    await waitFor(() => expect(label).toHaveFocus());
    await userEvent.type(label, 'Blog');
    expect(titles(group)[2]).toBe('Blog');

    await userEvent.click(within(group).getByRole('button', { name: 'Duplicate Blog' }));
    expect(titles(group)).toEqual(['Docs', 'Get started', 'Blog', 'Blog']);
    expect(within(group).getByText('4 of 4. Remove an item to add another.')).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Add button' })).toBeDisabled();
    expect(within(group).getByRole('button', { name: 'Duplicate Docs' })).toBeDisabled();
  });

  it('Remove works at once and Undo in the toast puts the item back in its place; at `min` Remove is disabled', async () => {
    const { group } = renderPage();
    await userEvent.click(within(group).getByRole('button', { name: 'Remove Docs' }));
    expect(titles(group)).toEqual(['Get started']);
    expect(within(group).getByRole('button', { name: 'Remove Get started' })).toBeDisabled(); // min: 1

    const toast = await waitFor(
      () => document.querySelector<HTMLElement>('[data-slot=fy-toast]') as HTMLElement,
    );
    expect(toast).toHaveTextContent('“Docs” removed');
    await act(() => userEvent.click(within(toast).getByRole('button', { name: 'Undo' })));
    expect(titles(group)).toEqual(['Docs', 'Get started']);
  });

  it('a save with an invalid sub-field opens its item, focuses the field and marks the item; nothing is sent', async () => {
    const { group, savePage } = renderPage();
    await userEvent.click(toggle(group, 'Get started'));
    await userEvent.clear(within(group).getByRole('textbox', { name: 'Label' }));
    await userEvent.click(toggle(group, 'Item 2')); // collapse it again: the error must still be found
    expect(within(group).queryByRole('textbox', { name: 'Label' })).toBeNull();

    await save();
    expect(savePage).not.toHaveBeenCalled();
    const label = await within(group).findByRole('textbox', { name: 'Label' });
    await waitFor(() => expect(label).toHaveFocus());
    expect(label).toHaveAttribute('aria-invalid', 'true');
    expect(within(group).getByText('This field is required.')).toBeInTheDocument();
    expect(within(group).getByText('1 error')).toBeInTheDocument();

    await userEvent.type(label, 'Start');
    expect(within(group).queryByText('1 error')).toBeNull(); // editing the sub-field clears its error
    await save();
    expect(sent(savePage)[1]).toEqual({
      label: 'Start',
      icon: 'flash',
      link: 'https://example.com/signup',
    });
  });
});
