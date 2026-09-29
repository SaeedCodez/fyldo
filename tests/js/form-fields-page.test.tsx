import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPage } from '../../app/components/fyldo/SettingsPage';
import { ApiError, type Api } from '../../app/lib/api';
import { PortalContainerContext } from '../../app/lib/portal';
import type { PageDef } from '../../app/types';

// The exact JSON PHP produces for the M2 page (kept fresh by tests/php/Unit/ClientContractTest.php).
const page = JSON.parse(readFileSync(resolve(__dirname, '../fixtures/form-fields-page.client.json'), 'utf8')) as PageDef;

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

describe('Form fields page (Textarea, Checkbox, Checkbox group, Radio group, Multi Select) — the whole save flow', () => {
  it('renders every field from the PHP description with its default', () => {
    setup();
    expect(screen.getByRole('textbox', { name: 'Default meta description' })).toHaveValue('Fyldo is a lightweight settings framework.');
    expect(screen.getByText(`${[...(page.values.meta_description as string)].length}/160`)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Show on' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'All post types' })).toHaveAttribute('aria-checked', 'true'); // Posts + Pages: every ENABLED option (Products is disabled)
    expect(screen.getByRole('checkbox', { name: 'Posts' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: 'Products' })).toHaveAttribute('data-disabled');
    expect(screen.getByRole('radiogroup', { name: 'Layout' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Full width' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: 'I agree to the terms' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull();
  });

  it('saves ONLY the changed fields: list in option order, string, boolean', async () => {
    const { savePage } = setup();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pages' })); // uncheck → ['post']
    await userEvent.click(screen.getByRole('radio', { name: 'Boxed' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'I agree to the terms' }));

    const bar = screen.getByRole('region', { name: 'Unsaved changes' });
    await userEvent.click(within(bar).getByRole('button', { name: 'Save changes' }));

    expect(savePage).toHaveBeenCalledWith('fields', { post_types: ['post'], layout: 'boxed', agree: true }, 'rev-1');
    expect(await screen.findByText('All changes saved')).toBeVisible();
  });

  it('the parent checkbox selects everything enabled: back to the stored list means nothing to save', async () => {
    setup();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pages' }));
    expect(screen.getByRole('region', { name: 'Unsaved changes' })).toBeVisible();
    await userEvent.click(screen.getByRole('checkbox', { name: 'All post types' }));
    expect(screen.getByRole('checkbox', { name: 'Pages' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull(); // ['post','page'] again = the stored value
  });

  it('client validation: unchecking everything breaks `min: 1` — the error shows on blur and blocks the save', async () => {
    const { savePage } = setup();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Posts' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pages' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'I agree to the terms' })); // moves focus out of the group
    expect(await screen.findByText('Select at least 1 option.')).toBeVisible();

    await userEvent.click(within(screen.getByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save changes' }));
    expect(savePage).not.toHaveBeenCalled();
  });

  it('a textarea over its limit shows the counter in error, keeps the text, and blocks the save with the same message as PHP', async () => {
    const { savePage } = setup();
    const box = screen.getByRole('textbox', { name: 'Default meta description' });
    await userEvent.clear(box);
    await userEvent.click(box);
    await userEvent.paste('x'.repeat(172));
    expect(screen.getByText('172/160').className).toContain('text-status-error-text');
    expect(box).toHaveValue('x'.repeat(172)); // never truncated

    await userEvent.click(within(screen.getByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save changes' }));
    expect(savePage).not.toHaveBeenCalled();
    expect(await screen.findByText('Use no more than 160 characters.')).toBeVisible();
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('172/160')).toBeInTheDocument(); // the counter stays next to the error
    expect(document.activeElement).toBe(box); // focus moves to the first invalid field
  });

  it('server errors (422) land on the right field, including groups', async () => {
    setup({
      savePage: async () => {
        throw new ApiError('Some values are not valid.', 422, 'fyldo_invalid', { layout: 'Choose one of the available options.' });
      },
    });
    await userEvent.click(screen.getByRole('radio', { name: 'Boxed' }));
    await userEvent.click(within(screen.getByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Choose one of the available options.')).toBeVisible();
    expect(screen.getByRole('radiogroup', { name: 'Layout' })).toHaveAttribute('aria-invalid', 'true');
  });
  it('Multi Select: shows the default as tags, saves the picked list in option order, and blocks `max` with the PHP message', async () => {
    const { savePage } = setup();
    const field = screen.getByRole('combobox', { name: 'Include in sitemap' });
    expect(field).toHaveTextContent('PostsPages');

    await userEvent.click(field);
    await userEvent.click(await screen.findByRole('option', { name: 'Tags' }));
    await userEvent.click(screen.getByRole('option', { name: 'Products' }));
    await userEvent.click(within(screen.getByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save changes' }));
    expect(savePage).toHaveBeenCalledWith('fields', { sitemap_types: ['post', 'page', 'product', 'tag'] }, 'rev-1');
  });

  it('Multi Select: `max: 5` is enforced in the browser before anything is sent', async () => {
    const { savePage } = setup();
    await userEvent.click(screen.getByRole('combobox', { name: 'Include in sitemap' }));
    for (const label of ['Products', 'Authors', 'Categories', 'Tags']) await userEvent.click(await screen.findByRole('option', { name: label }));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(screen.getByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save changes' }));
    expect(savePage).not.toHaveBeenCalled();
    expect(await screen.findByText('Select no more than 5 options.')).toBeVisible();
  });
});
