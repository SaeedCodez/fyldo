/**
 * M3 part 2: the two save patterns (a global Save Bar OR a Save in each Section Card footer), dirty tracking that
 * survives page switches, the unsaved-changes guard (in-app Modal on Fyldo navigation and Back/Forward,
 * `beforeunload` for leaving the screen), and the Modal's keyboard/ARIA contract.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/components/fyldo/App';
import { SettingsPage } from '../../app/components/fyldo/SettingsPage';
import { Modal } from '../../app/components/ui/modal';
import { ApiError, type Api } from '../../app/lib/api';
import { setLocaleData } from '../../app/i18n';
import { PortalContainerContext } from '../../app/lib/portal';
import type { FieldValue, FyldoConfig, PageDef } from '../../app/types';

const fixture = (name: string) => JSON.parse(readFileSync(resolve(__dirname, `../fixtures/${name}.client.json`), 'utf8')) as PageDef;
const general = fixture('slice-page'); // global save pattern
const advanced = fixture('tabs-page'); // per-section save pattern, with tabs

/** The per-section page with every card on one screen (no tabs). */
const allOnOnePage: PageDef = { ...advanced, tabs: [], sections: advanced.sections.map((s) => ({ ...s, tab: '' })) };

const within_root = () => {
  const root = document.createElement('div');
  document.body.append(root);
  return root;
};

function renderPage(def: PageDef, api: Partial<Api> = {}) {
  const savePage = vi.fn(api.savePage ?? (async (_id: string, values: Record<string, FieldValue>) => ({ values: { ...def.values, ...values }, revision: 'rev-2' })));
  const readPage = vi.fn(api.readPage ?? (async () => ({ values: def.values, revision: 'rev-1' })));
  render(
    <PortalContainerContext.Provider value={within_root()}>
      <SettingsPage page={def} api={{ savePage, readPage }} tab="cache" />
    </PortalContainerContext.Provider>,
  );
  return { savePage, readPage };
}

const card = (name: string) => screen.getByRole('region', { name });
const footerText = (region: HTMLElement) => region.querySelector('[data-slot=fy-section-card-footer-text]') as HTMLElement;

describe('per-section save pattern (save: "section")', () => {
  it('each card with fields has its own footer Save; there is never a Save Bar', async () => {
    renderPage(advanced);
    const cache = card('Page cache');
    expect(footerText(cache)).toHaveTextContent('Changes take effect after you save.');
    expect(footerText(cache)).toHaveAttribute('aria-live', 'polite');
    const save = within(cache).getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled(); // nothing to save yet
    expect(footerText(card('About these settings'))).toBeNull(); // a card without values has no footer

    await userEvent.clear(within(cache).getByRole('textbox', { name: 'Cache lifetime' }));
    await userEvent.type(within(cache).getByRole('textbox', { name: 'Cache lifetime' }), '120');
    expect(footerText(cache)).toHaveTextContent('You have unsaved changes');
    expect(save).toBeEnabled();
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull();
  });

  it('a card saves ONLY its own fields; edits in other cards stay dirty and unsent', async () => {
    const { savePage } = renderPage(allOnOnePage);
    const cache = card('Page cache');
    const debug = card('Debugging');
    const ttl = within(cache).getByRole('textbox', { name: 'Cache lifetime' });
    await userEvent.clear(ttl);
    await userEvent.type(ttl, '120');
    await userEvent.click(within(debug).getByRole('switch', { name: 'Write a debug log' }));

    await userEvent.click(within(cache).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(savePage).toHaveBeenCalledWith('advanced', { cache_ttl: 120 }, 'rev-1'));
    expect(await within(cache).findByText('All changes saved')).toBeVisible();
    expect(within(cache).getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(footerText(debug)).toHaveTextContent('You have unsaved changes');
    expect(within(debug).getByRole('switch', { name: 'Write a debug log' })).toHaveAttribute('aria-checked', 'true');
  });

  it('a failed card save shows the error in THAT footer (error colour) and on the field', async () => {
    renderPage(advanced, {
      savePage: async () => {
        throw new ApiError('Some values are not valid.', 422, 'fyldo_invalid', { cache_ttl: 'Too long.' });
      },
    });
    const cache = card('Page cache');
    await userEvent.type(within(cache).getByRole('textbox', { name: 'Cache lifetime' }), '0');
    await userEvent.click(within(cache).getByRole('button', { name: 'Save' }));
    expect(await within(cache).findByText('Too long.')).toBeVisible();
    expect(footerText(cache)).toHaveTextContent('Couldn’t save. Check the highlighted fields.');
    expect(footerText(cache).className).toContain('fy:text-status-error-text');
    expect(within(cache).getByRole('button', { name: 'Save' })).toBeEnabled(); // retry
  });

  it('two cards saved back to back are sent one after the other, the second with the first one’s revision', async () => {
    const both = allOnOnePage;
    let release: () => void = () => undefined;
    const calls: Array<[Record<string, FieldValue>, string]> = [];
    renderPage(both, {
      savePage: async (_id, values, revision) => {
        calls.push([values, revision]);
        if (calls.length === 1) await new Promise<void>((r) => (release = r));
        return { values: { ...both.values, ...values }, revision: `rev-${calls.length + 1}` };
      },
    });
    const cache = card('Page cache');
    const debug = card('Debugging');
    await userEvent.type(within(cache).getByRole('textbox', { name: 'Cache lifetime' }), '0');
    await userEvent.click(within(debug).getByRole('switch', { name: 'Write a debug log' }));
    await userEvent.click(within(cache).getByRole('button', { name: 'Save' }));
    await userEvent.click(within(debug).getByRole('button', { name: 'Save' }));
    expect(footerText(cache)).toHaveTextContent('Saving changes…');
    expect(calls).toHaveLength(1);
    await act(async () => release());
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0]).toEqual([{ cache_ttl: 600 }, 'rev-1']);
    expect(calls[1]).toEqual([{ debug_log: true }, 'rev-2']);
    expect(await within(debug).findByText('All changes saved')).toBeVisible();
    expect(within(cache).getByText('All changes saved')).toBeVisible();
  });
});

// ── The app: dirty tracking across pages, the unsaved-changes guard ────────────────────────────────────────────
function config(overrides: Partial<FyldoConfig> = {}): FyldoConfig {
  return {
    slug: 'acme-seo',
    title: 'Acme SEO',
    logo: null,
    version: '1.0',
    fyldoVersion: '1.0.0',
    navigation: 'sidebar',
    groups: [],
    links: [],
    pages: [general, advanced],
    dir: 'ltr',
    locale: 'en',
    rootId: 'fyldo-acme-seo-root',
    rest: { root: '/rest/', nonce: 'n', instanceNonce: 'i', nonceHeader: 'X-Fyldo-Nonce' },
    i18n: null,
    ...overrides,
  };
}

const requests: Array<{ url: string; method: string; body: Record<string, unknown> | null }> = [];

function mountApp(overrides: Partial<FyldoConfig> = {}) {
  const root = within_root();
  requests.length = 0;
  let revision = 1;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
      requests.push({ url, method: init.method ?? 'GET', body });
      revision += 1;
      const values = { ...general.values, ...((body?.values as object) ?? {}) };
      return new Response(JSON.stringify({ values, revision: `rev-${revision}` }), { status: 200 });
    }),
  );
  render(<App config={config(overrides)} root={root} />);
}

const nav = () => screen.getByRole('navigation', { name: 'Acme SEO' });
const dialog = () => screen.queryByRole('dialog');

beforeEach(() => {
  window.history.replaceState(null, '', '/wp-admin/options-general.php?page=acme-seo#/general');
});
afterEach(() => {
  vi.unstubAllGlobals();
  setLocaleData(null);
});

describe('unsaved-changes guard', () => {
  it('a clean page leaves without asking', async () => {
    mountApp();
    await userEvent.click(within(nav()).getByRole('link', { name: 'Advanced' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Advanced');
    expect(dialog()).toBeNull();
  });

  it('leaving a dirty page asks (the pack’s Default modal); Keep editing stays with the edits and returns focus', async () => {
    mountApp();
    await userEvent.type(screen.getByRole('textbox', { name: 'Site title' }), '!');
    const link = within(nav()).getByRole('link', { name: 'Advanced' });
    await userEvent.click(link);

    const modal = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    expect(modal).toHaveAccessibleDescription('Your edits on this page haven’t been saved and will be lost.');
    const buttons = within(modal).getAllByRole('button');
    // close (header) · Cancel at the start · Confirm at the end, in DOM order (RTL mirrors the row)
    expect(buttons.map((b) => b.textContent || b.getAttribute('aria-label'))).toEqual(['Close', 'Keep editing', 'Discard']);
    await waitFor(() => expect(within(modal).getByRole('button', { name: 'Keep editing' })).toHaveFocus()); // the safe choice
    expect(window.location.hash).toBe('#/general');

    await userEvent.click(within(modal).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('General');
    expect(screen.getByRole('textbox', { name: 'Site title' })).toHaveValue('Fyldo!');
    await waitFor(() => expect(link).toHaveFocus());
  });

  it('Esc and the close button dismiss it too (a Default modal)', async () => {
    mountApp();
    await userEvent.type(screen.getByRole('textbox', { name: 'Site title' }), '!');
    await userEvent.click(within(nav()).getByRole('link', { name: 'Advanced' }));
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(dialog()).toBeNull());

    await userEvent.click(within(nav()).getByRole('link', { name: 'Advanced' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('General');
  });

  it('Discard drops the edits and goes; coming back shows the stored values', async () => {
    mountApp();
    await userEvent.type(screen.getByRole('textbox', { name: 'Site title' }), '!');
    await userEvent.click(within(nav()).getByRole('link', { name: 'Advanced' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Advanced'));
    expect(window.location.hash).toBe('#/advanced');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus());

    await userEvent.click(within(nav()).getByRole('link', { name: 'General' }));
    expect(screen.getByRole('textbox', { name: 'Site title' })).toHaveValue('Fyldo');
  });

  it('switching tabs of a dirty page never asks: the tabs share the page’s form', async () => {
    mountApp();
    await userEvent.click(within(nav()).getByRole('link', { name: 'Advanced' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Cache lifetime' }), '0');
    await userEvent.click(screen.getByRole('tab', { name: /Debugging/ }));
    expect(dialog()).toBeNull();
    expect(window.location.hash).toBe('#/advanced/debug');
  });

  it('Back/Forward away from a dirty page asks; the URL stays on the shown page until Discard', async () => {
    mountApp();
    await userEvent.click(within(nav()).getByRole('link', { name: 'Advanced' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Cache lifetime' }), '0');

    act(() => {
      window.history.replaceState(null, '', '#/general'); // what Back does to the URL…
      window.dispatchEvent(new PopStateEvent('popstate')); // …and the event it fires
    });
    const modal = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    expect(window.location.hash).toBe('#/advanced'); // put back in place while the dialog decides
    expect(document.querySelector('h1')).toHaveTextContent('Advanced'); // (the page behind the modal is hidden from AT)

    const entries = window.history.length;
    await userEvent.click(within(modal).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('General'));
    expect(window.location.hash).toBe('#/general');
    expect(window.history.length).toBe(entries); // shown in place: no new history entry
  });

  it('beforeunload asks only while a page has unsaved edits', async () => {
    mountApp();
    const fire = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(fire()).toBe(false);
    await userEvent.type(screen.getByRole('textbox', { name: 'Site title' }), '!');
    expect(fire()).toBe(true);
    await userEvent.click(within(screen.getByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Discard' }));
    expect(fire()).toBe(false);
  });

  it('a page saved, left and revisited keeps its saved values and revision (no stale 409 on the next save)', async () => {
    mountApp();
    const title = screen.getByRole('textbox', { name: 'Site title' });
    await userEvent.type(title, '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('All changes saved');
    expect(requests[0]?.body).toEqual({ values: { site_title: 'Fyldo!' }, revision: 'rev-1' });

    await userEvent.click(within(nav()).getByRole('link', { name: 'Advanced' }));
    expect(dialog()).toBeNull(); // saved: nothing to lose
    await userEvent.click(within(nav()).getByRole('link', { name: 'General' }));
    expect(screen.getByRole('textbox', { name: 'Site title' })).toHaveValue('Fyldo!');

    await userEvent.type(screen.getByRole('textbox', { name: 'Site title' }), '?');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(requests[1]?.body).toEqual({ values: { site_title: 'Fyldo!?' }, revision: 'rev-2' }));
  });
});

describe('Persian (RTL)', () => {
  it('the Save Bar and the dialog speak Persian as the pack draws them; Cancel stays first in the DOM (mirrored by the row)', async () => {
    setLocaleData(JSON.parse(readFileSync(resolve(__dirname, '../../languages/fyldo-fa_IR.json'), 'utf8')));
    mountApp({ dir: 'rtl', locale: 'fa-IR' });
    await userEvent.type(screen.getByRole('textbox', { name: 'Site title' }), '!');
    const bar = screen.getByRole('region', { name: 'تغییرات ذخیره‌نشده' });
    expect(within(bar).getByText('تغییرات ذخیره‌نشده دارید')).toBeVisible();
    expect(within(bar).getByRole('button', { name: 'لغو تغییرات' })).toBeEnabled();
    expect(within(bar).getByRole('button', { name: 'ذخیره‌ی تغییرات' })).toBeEnabled();

    await userEvent.click(within(nav()).getByRole('link', { name: 'Advanced' }));
    const modal = await screen.findByRole('dialog', { name: 'تغییرات ذخیره‌نشده حذف شوند؟' });
    expect(modal).toHaveAccessibleDescription('ویرایش‌های این صفحه ذخیره نشده‌اند و از بین می‌روند.');
    expect(within(modal).getAllByRole('button').map((b) => b.textContent || b.getAttribute('aria-label'))).toEqual(['بستن', 'ادامه‌ی ویرایش', 'حذف تغییرات']);
  });
});

describe('Modal (Default)', () => {
  it('is portalled into the Fyldo root, named by its title and described by its text', async () => {
    const root = within_root();
    const onConfirm = vi.fn();
    render(
      <PortalContainerContext.Provider value={root}>
        <Modal open onOpenChange={() => undefined} title="Discard unsaved changes?" description="Gone." cancelLabel="Keep editing" confirmLabel="Discard" onConfirm={onConfirm} />
      </PortalContainerContext.Provider>,
    );
    const modal = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    expect(root.contains(modal)).toBe(true);
    expect(modal).toHaveAttribute('data-slot', 'fy-modal');
    expect(modal).toHaveAccessibleDescription('Gone.');
    await userEvent.click(within(modal).getByRole('button', { name: 'Discard' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
