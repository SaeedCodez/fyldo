/**
 * M4 — danger-zone actions and PHP notices in the app: the Danger Section Card's "reset to defaults" (confirmed with the
 * Danger modal, sent through REST with the typed keyword), its toasts, and `Instance::admin_notice()` notices drawn in
 * Fyldo's own slot.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/components/fyldo/App';
import { SettingsPage } from '../../app/components/fyldo/SettingsPage';
import { ToastProvider } from '../../app/components/ui/toast';
import { TooltipProvider } from '../../app/components/ui/tooltip';
import { setLocaleData } from '../../app/i18n';
import { ApiError, createApi, type Api } from '../../app/lib/api';
import { PortalContainerContext } from '../../app/lib/portal';
import { createToaster, type Toaster } from '../../app/lib/toast';
import type { FyldoConfig, NoticeDef, PageDef } from '../../app/types';

const fixture = (name: string) => JSON.parse(readFileSync(resolve(__dirname, `../fixtures/${name}.client.json`), 'utf8')) as PageDef;
// the "fields" page: global Save Bar, a write-only password, and (M4) a Danger card with the keyword RESET
const fields = fixture('form-fields-page');
const general = fixture('slice-page');

// what the page holds before the reset (something saved earlier) and what the server returns after it (the defaults)
const DEFAULT_TEXT = 'Fyldo is a lightweight settings framework.';
const saved: PageDef = { ...fields, values: { ...fields.values, meta_description: 'Saved earlier' } };
const DEFAULTS = fields.values;

let toaster: Toaster;
let root: HTMLElement;

function renderPage(api: Partial<Api> = {}, def: PageDef = saved) {
  toaster = createToaster();
  root = document.createElement('div');
  document.body.append(root);
  const runAction = vi.fn(api.runAction ?? (async () => ({ values: DEFAULTS, revision: 'rev-reset' })));
  const savePage = vi.fn(api.savePage ?? (async () => ({ values: def.values, revision: 'rev-2' })));
  render(
    <PortalContainerContext.Provider value={root}>
      <TooltipProvider>
        <ToastProvider toaster={toaster}>
          <SettingsPage page={def} api={{ savePage, readPage: vi.fn(), runAction }} />
        </ToastProvider>
      </TooltipProvider>
    </PortalContainerContext.Provider>,
  );
  return { runAction, savePage };
}

const card = () => screen.getByRole('region', { name: 'Reset settings' });
const resetButton = () => within(card()).getByRole('button', { name: 'Reset settings' });
const dialog = () => screen.getByRole('alertdialog', { name: 'Reset all settings?' });
const toasts = () => [...document.querySelectorAll<HTMLElement>('[data-slot=fy-toast]')];

afterEach(() => {
  setLocaleData(null);
  vi.unstubAllGlobals();
});

describe('Danger Section Card', () => {
  it('shows its header and the pack footer: "This action can’t be undone." + an Error button; no fields, never a Save', () => {
    renderPage();
    const region = card();
    expect(region).toHaveAttribute('data-tone', 'danger');
    expect(within(region).getByRole('heading', { level: 2, name: 'Reset settings' })).toBeInTheDocument();
    expect(within(region).getByText('Restore every option on this page to its default value.')).toBeInTheDocument();
    expect(within(region).getByText('This action can’t be undone.')).toBeInTheDocument();
    expect(resetButton()).toHaveAttribute('data-variant', 'error');
    expect(within(region).queryByRole('button', { name: 'Save' })).toBeNull();
  });
});

describe('reset to defaults', () => {
  it('opens the Danger modal with the developer’s keyword; nothing is sent until it is typed and confirmed', async () => {
    const { runAction } = renderPage();
    await userEvent.click(resetButton());

    const modal = dialog();
    expect(modal).toHaveAccessibleDescription('Every option on this page will return to its default value. This can’t be undone.');
    const confirm = within(modal).getByRole('button', { name: 'Reset settings' });
    expect(confirm).toBeDisabled();
    await waitFor(() => expect(within(modal).getByRole('textbox', { name: 'Type RESET to confirm' })).toHaveFocus());
    expect(runAction).not.toHaveBeenCalled();

    await userEvent.type(within(modal).getByRole('textbox'), 'RESET');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await waitFor(() => expect(runAction).toHaveBeenCalledWith('fields', 'reset', 'RESET'));
  });

  it('replaces every value with the defaults the server returns, drops unsaved edits, closes the modal and says so in a toast', async () => {
    renderPage();
    const name = screen.getByRole('textbox', { name: 'Default meta description' });
    await userEvent.type(name, ' edited'); // an unsaved edit: the Save Bar is up
    expect(name).toHaveValue('Saved earlier edited');
    expect(screen.getByRole('region', { name: 'Unsaved changes' })).toBeInTheDocument();

    await userEvent.click(resetButton());
    await userEvent.type(within(dialog()).getByRole('textbox'), 'RESET');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Reset settings' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByRole('textbox', { name: 'Default meta description' })).toHaveValue(DEFAULT_TEXT);
    // the Save Bar is gone: nothing is dirty any more
    await waitFor(() => expect(screen.queryByText('You have unsaved changes')).toBeNull());
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]).toHaveAttribute('data-tone', 'success');
    expect(toasts()[0]).toHaveTextContent('Settings reset to defaults');
    // the reset returned the page to the calm state: focus is back on the button that opened the dialog
    await waitFor(() => expect(resetButton()).toHaveFocus());
  });

  it('while it runs the modal shows it (Confirm loading, Cancel disabled) and cannot be closed', async () => {
    let finish: () => void = () => undefined;
    const { runAction } = renderPage({ runAction: () => new Promise((resolve) => (finish = () => resolve({ values: DEFAULTS, revision: 'rev-reset' }))) });
    await userEvent.click(resetButton());
    await userEvent.type(within(dialog()).getByRole('textbox'), 'RESET');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Reset settings' }));

    await waitFor(() => expect(runAction).toHaveBeenCalled());
    expect(within(dialog()).getByRole('button', { name: 'Reset settings' })).toHaveAttribute('aria-busy', 'true');
    expect(within(dialog()).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(dialog()).toBeInTheDocument();

    await act(async () => finish());
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('Cancel changes nothing', async () => {
    const { runAction } = renderPage();
    await userEvent.click(resetButton());
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(runAction).not.toHaveBeenCalled();
    expect(toasts()).toHaveLength(0);
  });

  it('a failed request (network) closes the modal and shows an Error toast with Retry, which tries again', async () => {
    let attempts = 0;
    const { runAction } = renderPage({
      runAction: async () => {
        attempts += 1;
        if (attempts === 1) throw new ApiError('network', 0, 'fyldo_network');
        return { values: DEFAULTS, revision: 'rev-reset' };
      },
    });
    await userEvent.click(resetButton());
    await userEvent.type(within(dialog()).getByRole('textbox'), 'RESET');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Reset settings' }));

    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()[0]).toHaveAttribute('data-tone', 'error');
    expect(toasts()[0]).toHaveTextContent("Couldn't reset settings. Check your connection and try again.");
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Default meta description' })).toHaveValue('Saved earlier'); // nothing changed

    // Retry: one verb, the same confirmed action
    await userEvent.click(within(toasts()[0] as HTMLElement).getByRole('button', { name: 'Retry', hidden: true }));
    await waitFor(() => expect(runAction).toHaveBeenCalledTimes(2));
    expect(runAction).toHaveBeenLastCalledWith('fields', 'reset', 'RESET');
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Default meta description' })).toHaveValue(DEFAULT_TEXT));
    await waitFor(() => expect(toasts().some((t) => t.dataset.tone === 'success')).toBe(true));
  });

  it('a refusal from the server (e.g. an expired session) shows its message, without Retry', async () => {
    renderPage({ runAction: async () => Promise.reject(new ApiError('Your session has expired. Reload the page and try again.', 403, 'fyldo_bad_nonce')) });
    await userEvent.click(resetButton());
    await userEvent.type(within(dialog()).getByRole('textbox'), 'RESET');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Reset settings' }));

    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()[0]).toHaveTextContent('Your session has expired. Reload the page and try again.');
    expect(within(toasts()[0] as HTMLElement).queryByRole('button', { name: 'Retry', hidden: true })).toBeNull();
  });

  it('a Danger card without a keyword asks with the modal only (no typing) and uses the developer’s texts', async () => {
    const def: PageDef = {
      ...general,
      sections: [
        ...general.sections,
        {
          id: 'wipe',
          tab: '',
          title: 'Wipe everything',
          description: 'Start over.',
          tone: 'danger',
          fields: [],
          action: { id: 'reset', label: 'Wipe now', confirm: { title: 'Wipe the site settings?', description: 'All of them, gone.', keyword: '', label: 'Wipe' } },
        },
      ],
    };
    const { runAction } = renderPage({}, def);
    await userEvent.click(within(screen.getByRole('region', { name: 'Wipe everything' })).getByRole('button', { name: 'Wipe now' }));
    const modal = screen.getByRole('alertdialog', { name: 'Wipe the site settings?' });
    expect(modal).toHaveAccessibleDescription('All of them, gone.');
    expect(within(modal).queryByRole('textbox')).toBeNull();
    await userEvent.click(within(modal).getByRole('button', { name: 'Wipe' }));
    await waitFor(() => expect(runAction).toHaveBeenCalledWith('general', 'reset', ''));
  });

  it('Persian: the pack’s strings', async () => {
    setLocaleData({
      locale_data: {
        messages: {
          '': { domain: 'fyldo' },
          'This action can’t be undone.': ['این کار قابل بازگشت نیست.'],
          'Reset all settings?': ['همه‌ی تنظیمات بازنشانی شوند؟'],
          'Type %s to confirm': ['برای تأیید، «%s» را تایپ کنید'],
          Cancel: ['انصراف'],
        },
      },
    });
    renderPage();
    expect(screen.getByText('این کار قابل بازگشت نیست.')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('region', { name: 'Reset settings' })).getByRole('button', { name: 'Reset settings' }));
    const modal = screen.getByRole('alertdialog', { name: 'همه‌ی تنظیمات بازنشانی شوند؟' });
    expect(within(modal).getByRole('textbox', { name: 'برای تأیید، «RESET» را تایپ کنید' })).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'انصراف' })).toBeInTheDocument();
  });
});

describe('REST client: runAction', () => {
  it('POSTs the keyword to …/pages/{page}/actions/{action} with both nonces and returns the new values', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ values: { a: 1 }, revision: 'r9' }), { status: 200 });
    });
    const api = createApi({ rest: { root: '/wp-json/fyldo-acme/v1/', nonce: 'wp-n', instanceNonce: 'fy-n', nonceHeader: 'X-Fyldo-Nonce' } }, fetchImpl as never);

    await expect(api.runAction('fields', 'reset', 'RESET')).resolves.toEqual({ values: { a: 1 }, revision: 'r9' });
    expect(calls[0]?.url).toBe('/wp-json/fyldo-acme/v1/pages/fields/actions/reset');
    expect(calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ keyword: 'RESET' });
    expect(calls[0]?.init.headers).toMatchObject({ 'X-WP-Nonce': 'wp-n', 'X-Fyldo-Nonce': 'fy-n', 'Content-Type': 'application/json' });
  });

  it('a 400 (wrong keyword) rejects with the server message and status', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ code: 'fyldo_confirmation', message: 'The confirmation text does not match.', data: { status: 400 } }), { status: 400 }));
    const api = createApi({ rest: { root: '/r/', nonce: 'n', instanceNonce: 'i', nonceHeader: 'X-Fyldo-Nonce' } }, fetchImpl as never);
    await expect(api.runAction('fields', 'reset', 'nope')).rejects.toMatchObject({ status: 400, code: 'fyldo_confirmation', message: 'The confirmation text does not match.' });
  });
});

// ── PHP notices (Instance::admin_notice) ──────────────────────────────────────────────────────────────────────
function config(notices: NoticeDef[]): FyldoConfig {
  return {
    slug: 'acme-seo',
    title: 'Acme SEO',
    logo: null,
    version: '1.0',
    fyldoVersion: '1.0.0',
    navigation: 'sidebar',
    groups: [],
    links: [],
    notices,
    pages: [general, fields],
    dir: 'ltr',
    locale: 'en',
    rootId: 'fyldo-acme-seo-root',
    rest: { root: '/rest/', nonce: 'n', instanceNonce: 'i', nonceHeader: 'X-Fyldo-Nonce' },
    i18n: null,
  };
}

const notice = (over: Partial<NoticeDef>): NoticeDef => ({ id: 'n1', tone: 'blue', title: '', message: 'A new version is available.', dismissible: true, page: '', action: null, ...over });

describe('PHP notices in Fyldo’s own slot', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/wp-admin/options-general.php?page=acme-seo#/general');
  });

  function mountApp(notices: NoticeDef[]) {
    const host = document.createElement('div');
    document.body.append(host);
    render(<App config={config(notices)} root={host} />);
    return host;
  }
  const slot = () => document.querySelector<HTMLElement>('[data-slot=fy-notices]');

  it('are drawn under the Page Header, in the order PHP sent them (most severe first), as labelled regions with the tone word', () => {
    mountApp([
      notice({ id: 'a', tone: 'red', title: 'Couldn’t connect to the API', message: 'Check your API key and try again.', dismissible: false, action: { label: 'View logs', url: 'https://acme.test/logs', external: true } }),
      notice({ id: 'b', tone: 'blue', message: 'A new version of Acme is available.' }),
    ]);
    const region = slot() as HTMLElement;
    expect(region).not.toBeNull();
    expect(within(region).getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Error: Couldn’t connect to the API', 'Information']);
    // between the page header and the first card
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const link = within(region).getByRole('link', { name: /View logs/ });
    expect(link).toHaveAttribute('href', 'https://acme.test/logs');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    // an error stays until resolved: no dismiss; the info notice can be dismissed
    expect(within(within(region).getByRole('region', { name: 'Error: Couldn’t connect to the API' })).queryByRole('button', { name: 'Dismiss' })).toBeNull();
    expect(within(within(region).getByRole('region', { name: 'Information' })).getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('never carry the WordPress `notice` class, so core JS cannot move them out of the screen', () => {
    const host = mountApp([notice({ tone: 'green' }), notice({ id: 'n2', tone: 'amber', dismissible: false })]);
    expect(host.querySelectorAll('.notice, .updated, .error, [class*="notice-"]')).toHaveLength(0);
  });

  it('a notice for one page shows only there', async () => {
    mountApp([notice({ id: 'only-fields', page: 'fields', message: 'Only on the fields page.' })]);
    expect(screen.queryByText('Only on the fields page.')).toBeNull();
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Acme SEO' })).getByRole('link', { name: 'Content' }));
    expect(await screen.findByText('Only on the fields page.')).toBeInTheDocument();
  });

  it('Dismiss removes it, keeps it gone across page switches, and puts focus on the page heading', async () => {
    mountApp([notice({}), notice({ id: 'n2', tone: 'gray', message: 'Second.' })]);
    const first = screen.getByRole('region', { name: 'Information' });
    await userEvent.click(within(first).getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByRole('region', { name: 'Information' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Note' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();

    await userEvent.click(within(screen.getByRole('navigation', { name: 'Acme SEO' })).getByRole('link', { name: 'Content' }));
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Acme SEO' })).getByRole('link', { name: 'General' }));
    expect(screen.queryByRole('region', { name: 'Information' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Note' })).toBeInTheDocument();
  });

  it('no notices, no slot', () => {
    mountApp([]);
    expect(slot()).toBeNull();
  });
});
