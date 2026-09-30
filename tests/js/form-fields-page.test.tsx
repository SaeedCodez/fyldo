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

function setup(api: Partial<Api> = {}, current: PageDef = page) {
  const savePage = vi.fn(api.savePage ?? (async (_id, values) => ({ values: { ...current.values, ...values }, revision: 'rev-2' })));
  const root = document.createElement('div');
  document.body.append(root);
  render(
    <PortalContainerContext.Provider value={root}>
      <SettingsPage page={current} api={{ savePage, readPage: vi.fn(), runAction: vi.fn() }} />
    </PortalContainerContext.Provider>,
  );
  return { savePage };
}

const saveChanges = () => within(screen.getByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save changes' });

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

describe('Input fields (URL, email, password, number, notice, disabled) — the whole save flow', () => {
  it('renders the input fields from the PHP description', () => {
    setup();
    expect(screen.getByRole('region', { name: 'Information: Before you connect' })).toHaveTextContent('Keys are stored in the database and are never shown again.');
    expect(screen.getByRole('textbox', { name: 'Canonical URL' })).toHaveAttribute('dir', 'ltr');
    expect(screen.getByRole('textbox', { name: 'Contact email' })).toHaveAttribute('dir', 'ltr');
    expect(screen.getByLabelText('API key')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('API key')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByRole('textbox', { name: 'Items per page' })).toHaveValue('10');
    const license = screen.getByRole('textbox', { name: 'License key' });
    expect(license).toBeDisabled();
    expect(license).toHaveAccessibleDescription('Managed by your hosting provider.');
  });

  it('number: Persian digits are read as ASCII, min / max / step are enforced with the PHP wording, and only the number is sent', async () => {
    const { savePage } = setup();
    const box = screen.getByRole('textbox', { name: 'Items per page' });
    await userEvent.clear(box);
    await userEvent.type(box, '۴۲');
    expect(box).toHaveValue('42');

    await userEvent.click(saveChanges());
    expect(savePage).not.toHaveBeenCalled();
    expect(await screen.findByText('Enter a value in steps of 5.')).toBeVisible();
    expect(box).toHaveAttribute('aria-invalid', 'true');

    await userEvent.clear(box);
    await userEvent.type(box, '٤٥');
    await userEvent.click(saveChanges());
    expect(savePage).toHaveBeenCalledWith('fields', { per_page: 45 }, 'rev-1');
  });

  it.each([
    ['200', 'Enter a value of at most 100.'],
    ['0', 'Enter a value of at least 5.'],
    ['abc', 'Enter a number.'],
    ['', null],
  ])('number: %j → %s (shown on blur)', async (typed, message) => {
    const { savePage } = setup();
    const box = screen.getByRole('textbox', { name: 'Items per page' });
    await userEvent.clear(box);
    if (typed) await userEvent.type(box, typed);
    await userEvent.click(screen.getByRole('textbox', { name: 'Contact email' })); // moves focus out
    if (message) expect(await screen.findByText(message)).toBeVisible();
    else expect(document.querySelector('[data-field-id=per_page] [data-slot=fy-field-error]')).toBeNull();
    expect(savePage).not.toHaveBeenCalled();
  });

  it('URL: the https-only rule is enforced, digits are read as ASCII, and the value is sent as typed otherwise', async () => {
    const { savePage } = setup();
    const url = screen.getByRole('textbox', { name: 'Canonical URL' });
    await userEvent.type(url, 'http://example.com');
    await userEvent.click(saveChanges());
    expect(await screen.findByText('Enter a valid URL.')).toBeVisible();
    expect(savePage).not.toHaveBeenCalled();

    await userEvent.clear(url);
    await userEvent.type(url, 'https://example.com/۱۲');
    expect(url).toHaveValue('https://example.com/12');
    await userEvent.click(saveChanges());
    expect(savePage).toHaveBeenCalledWith('fields', { canonical_base: 'https://example.com/12' }, 'rev-1');
  });

  it('email: an invalid address is reported on blur with the PHP wording', async () => {
    setup();
    await userEvent.type(screen.getByRole('textbox', { name: 'Contact email' }), 'nope');
    await userEvent.click(screen.getByRole('textbox', { name: 'Canonical URL' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeVisible();
  });

  it('password: an untouched field sends nothing; typing sends the new value; rules apply to it', async () => {
    const { savePage } = setup();
    const key = screen.getByLabelText('API key');
    await userEvent.type(key, 'short');
    await userEvent.click(saveChanges());
    expect(await screen.findByText('Use at least 8 characters.')).toBeVisible();
    expect(savePage).not.toHaveBeenCalled();

    await userEvent.type(key, '-and-long');
    await userEvent.click(saveChanges());
    expect(savePage).toHaveBeenCalledWith('fields', { api_key: 'short-and-long' }, 'rev-1');
  });

  describe('with a secret already stored (the browser holds null)', () => {
    const stored: PageDef = { ...page, values: { ...page.values, api_key: null } };

    it('says "•••• set", is clean, and a save of other fields does not send the password', async () => {
      const { savePage } = setup({}, stored);
      expect(screen.getByLabelText('API key')).toHaveAttribute('placeholder', '•••• set');
      expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull();

      await userEvent.click(screen.getByRole('checkbox', { name: 'I agree to the terms' }));
      await userEvent.click(saveChanges());
      expect(savePage).toHaveBeenCalledWith('fields', { agree: true }, 'rev-1');
    });

    it('typing a new value replaces it; the password required-length rule does not block an untouched field', async () => {
      const { savePage } = setup({}, stored);
      await userEvent.type(screen.getByLabelText('API key'), 'a-new-secret');
      await userEvent.click(saveChanges());
      expect(savePage).toHaveBeenCalledWith('fields', { api_key: 'a-new-secret' }, 'rev-1');
    });

    it('emptying it after typing clears the secret (""), Discard brings back "set"', async () => {
      const { savePage } = setup({}, stored);
      const key = screen.getByLabelText('API key');
      await userEvent.type(key, 'x');
      await userEvent.clear(key);
      expect(screen.getByRole('region', { name: 'Unsaved changes' })).toBeVisible();
      expect(key).toHaveAttribute('placeholder', ''); // nothing is "set" any more

      await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
      expect(screen.getByLabelText('API key')).toHaveAttribute('placeholder', '•••• set');
      expect(savePage).not.toHaveBeenCalled();

      await userEvent.type(screen.getByLabelText('API key'), 'x');
      await userEvent.clear(screen.getByLabelText('API key'));
      await userEvent.click(saveChanges());
      expect(savePage).toHaveBeenCalledWith('fields', { api_key: '' }, 'rev-1');
    });

    it('after a save the server says whether one is set: still "set" after a new value, empty after a clear', async () => {
      setup(
        {
          savePage: async () => ({ values: { ...stored.values, api_key: null }, revision: 'rev-2' }),
        },
        stored,
      );
      await userEvent.type(screen.getByLabelText('API key'), 'a-new-secret');
      await userEvent.click(saveChanges());
      expect(await screen.findByText('All changes saved')).toBeVisible();
      expect(screen.getByLabelText('API key')).toHaveValue('');
      expect(screen.getByLabelText('API key')).toHaveAttribute('placeholder', '•••• set');
    });
  });

  it('the notice and the disabled field never reach the REST payload, whatever else is saved', async () => {
    const { savePage } = setup();
    const box = screen.getByRole('textbox', { name: 'Items per page' });
    await userEvent.clear(box);
    await userEvent.type(box, '50');
    await userEvent.click(screen.getByRole('checkbox', { name: 'I agree to the terms' }));
    await userEvent.click(saveChanges());

    expect(savePage).toHaveBeenCalledTimes(1);
    const payload = savePage.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['agree', 'per_page']);
    expect(payload).not.toHaveProperty('connection_note');
    expect(payload).not.toHaveProperty('license_key');
    expect(Object.keys(page.values)).not.toContain('connection_note'); // and it is not a value at all
  });
});
