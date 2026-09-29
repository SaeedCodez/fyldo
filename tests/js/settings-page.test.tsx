import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPage } from '../../app/components/fyldo/SettingsPage';
import { ApiError, type Api } from '../../app/lib/api';
import { PortalContainerContext } from '../../app/lib/portal';
import type { PageDef } from '../../app/types';

// The exact JSON PHP produces for the slice page (kept fresh by tests/php/Unit/ClientContractTest.php).
const page = JSON.parse(readFileSync(resolve(__dirname, '../fixtures/slice-page.client.json'), 'utf8')) as PageDef;

function setup(api: Partial<Api> = {}) {
  const savePage = vi.fn(api.savePage ?? (async (_id, values) => ({ values: { ...page.values, ...values }, revision: 'rev-2' })));
  const root = document.createElement('div');
  document.body.append(root);
  render(
    <PortalContainerContext.Provider value={root}>
      <SettingsPage page={page} api={{ savePage }} />
    </PortalContainerContext.Provider>,
  );
  return { savePage };
}

describe('Settings page (global save pattern)', () => {
  it('renders the page: header, both cards, every field, and NO save bar while clean', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'General' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Site identity' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Language & region' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Site title' })).toHaveValue('Fyldo');
    expect(screen.getByRole('switch', { name: 'Maintenance mode' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: '24-hour time' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('combobox', { name: 'Site language' })).toHaveTextContent('English (United States)');
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull();
  });

  it('editing shows the save bar; discard restores; saving sends ONLY the changed fields with the revision', async () => {
    const { savePage } = setup();
    const title = screen.getByRole('textbox', { name: 'Site title' });

    await userEvent.clear(title);
    await userEvent.type(title, 'Acme');
    await userEvent.click(screen.getByRole('switch', { name: 'Maintenance mode' }));
    const bar = screen.getByRole('region', { name: 'Unsaved changes' });
    expect(within(bar).getByText('You have unsaved changes')).toBeVisible();

    await userEvent.click(within(bar).getByRole('button', { name: 'Discard' }));
    expect(title).toHaveValue('Fyldo');
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull();

    await userEvent.clear(title);
    await userEvent.type(title, 'Acme');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(savePage).toHaveBeenCalledTimes(1));
    expect(savePage).toHaveBeenCalledWith('general', { site_title: 'Acme' }, 'rev-1');
    expect(await screen.findByText('All changes saved')).toBeVisible();
  });

  it('shows Saving… with a disabled, busy Save button while the request runs', async () => {
    let finish: (v: { values: typeof page.values; revision: string }) => void = () => undefined;
    setup({ savePage: () => new Promise((resolve) => (finish = resolve)) });

    await userEvent.type(screen.getByRole('textbox', { name: 'Site title' }), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Saving changes…')).toBeVisible();
    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Discard' })).toBeDisabled();

    finish({ values: { ...page.values, site_title: 'Fyldo!' }, revision: 'r2' });
    expect(await screen.findByText('All changes saved')).toBeVisible();
  });

  it('validates on blur (client mirror of the server rules) and blocks the request on submit', async () => {
    const { savePage } = setup();
    const title = screen.getByRole('textbox', { name: 'Site title' });

    await userEvent.clear(title);
    await userEvent.tab(); // blur
    expect(await screen.findByText('This field is required.')).toBeVisible();
    expect(title).toHaveAttribute('aria-invalid', 'true');

    await userEvent.type(title, 'x'.repeat(61));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Use no more than 60 characters.')).toBeVisible();
    expect(savePage).not.toHaveBeenCalled();
    await waitFor(() => expect(title).toHaveFocus()); // focus moves to the first invalid field
  });

  it('server-side 422 errors land on their field and keep the bar in the dirty state', async () => {
    setup({
      savePage: async () => {
        throw new ApiError('Some values are not valid.', 422, 'fyldo_invalid', { tagline: 'Reserved word.' });
      },
    });
    const tagline = screen.getByRole('textbox', { name: 'Tagline' });
    await userEvent.type(tagline, ' admin');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Reserved word.')).toBeVisible();
    expect(tagline).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('You have unsaved changes')).toBeVisible();
  });

  it('a network failure shows the error bar and keeps the edits for a retry', async () => {
    setup({
      savePage: async () => {
        throw new ApiError('network', 0, 'fyldo_network');
      },
    });
    const title = screen.getByRole('textbox', { name: 'Site title' });
    await userEvent.type(title, '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText("Couldn't save. Check your connection and try again.")).toBeVisible();
    expect(title).toHaveValue('Fyldo!');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled(); // retry
  });

  it('a conflict adopts the latest stored values and says why', async () => {
    setup({
      savePage: async () => {
        throw new ApiError('These settings were changed somewhere else. Reload to see the latest values.', 409, 'fyldo_conflict', {}, { values: { ...page.values, site_title: 'Theirs' }, revision: 'r9' });
      },
    });
    await userEvent.type(screen.getByRole('textbox', { name: 'Site title' }), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/changed somewhere else/)).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Site title' })).toHaveValue('Theirs');
  });

  it('the Select persists through the same dirty/save path', async () => {
    const { savePage } = setup();
    await userEvent.click(screen.getByRole('combobox', { name: 'Site language' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Deutsch' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(savePage).toHaveBeenCalledWith('general', { language: 'de_DE' }, 'rev-1'));
  });
});
