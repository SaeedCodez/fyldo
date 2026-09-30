/**
 * M3 part 1: routing (URL ⇄ page/tab, Back/Forward, deep links), the navigation landmarks of both layouts, the Tabs
 * keyboard model (manual activation, RTL arrows), the ≤782px Menu disclosure, and Persian numerals in the shell.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/components/fyldo/App';
import { SettingsPage } from '../../app/components/fyldo/SettingsPage';
import { setLocaleData } from '../../app/i18n';
import { parseHash, resolveRoute, routeHash } from '../../app/lib/router';
import { PortalContainerContext } from '../../app/lib/portal';
import type { FyldoConfig, PageDef } from '../../app/types';

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(resolve(__dirname, `../fixtures/${name}.client.json`), 'utf8'),
  ) as PageDef;
const general = { ...fixture('slice-page'), group: 'settings' };
const fields = { ...fixture('form-fields-page'), group: 'settings', badge: '3' };
const advanced = fixture('tabs-page'); // saves per section
const advancedGlobal: PageDef = { ...advanced, save: 'global' };
const pages = [general, fields, advanced];

function config(overrides: Partial<FyldoConfig> = {}): FyldoConfig {
  return {
    slug: 'acme-seo',
    title: 'Acme SEO',
    logo: null,
    version: '1.0',
    fyldoVersion: '1.0.0',
    navigation: 'sidebar',
    groups: [
      { id: 'settings', label: 'Settings' },
      { id: 'tools', label: 'Tools' },
    ],
    links: [
      {
        label: 'Documentation',
        url: 'https://acme.test/docs',
        icon: 'book-1',
        external: true,
        placement: 'footer',
      },
      {
        label: 'Changelog',
        url: 'https://acme.test/changes',
        icon: '',
        external: true,
        placement: 'header',
      },
    ],
    notices: [],
    pages,
    dir: 'ltr',
    locale: 'en',
    rootId: 'fyldo-acme-seo-root',
    rest: { root: '/rest/', nonce: 'n', instanceNonce: 'i', nonceHeader: 'X-Fyldo-Nonce' },
    i18n: null,
    ...overrides,
  };
}

function mount(overrides: Partial<FyldoConfig> = {}) {
  const root = document.createElement('div');
  document.body.append(root);
  return render(<App config={config(overrides)} root={root} />);
}

beforeEach(() => {
  window.history.replaceState(null, '', '/wp-admin/options-general.php?page=acme-seo');
});

afterEach(() => {
  setLocaleData(null);
  vi.unstubAllGlobals();
});

describe('router', () => {
  it('reads `#/<page>/<tab>`', () => {
    expect(parseHash('#/advanced/debug')).toEqual({ page: 'advanced', tab: 'debug' });
    expect(parseHash('#/general')).toEqual({ page: 'general', tab: '' });
    expect(parseHash('')).toEqual({ page: '', tab: '' });
    expect(parseHash('#/a%20b/%E0%A4')).toEqual({ page: 'a b', tab: '' }); // a broken escape is ignored, not thrown
  });

  it('falls back to the first page / first tab for anything unknown', () => {
    expect(resolveRoute(pages, { page: 'nope', tab: 'x' })).toEqual({ page: 'general', tab: '' });
    expect(resolveRoute(pages, { page: 'advanced', tab: 'nope' })).toEqual({
      page: 'advanced',
      tab: 'cache',
    });
    expect(resolveRoute(pages, { page: 'advanced', tab: 'debug' })).toEqual({
      page: 'advanced',
      tab: 'debug',
    });
  });

  it('the first tab has the short link; other tabs name themselves', () => {
    expect(routeHash(pages, { page: 'advanced', tab: 'cache' })).toBe('#/advanced');
    expect(routeHash(pages, { page: 'advanced', tab: 'debug' })).toBe('#/advanced/debug');
  });
});

describe('sidebar layout', () => {
  it('one navigation landmark named by the plugin, groups labelled by their visible label, the current page marked', () => {
    mount();
    const nav = screen.getByRole('navigation', { name: 'Acme SEO' });
    const settings = within(nav).getByRole('list', { name: 'Settings' });
    expect(
      within(settings)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['General', 'Content3']);
    expect(within(nav).getByRole('list', { name: 'Tools' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'General' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: /Content/ })).not.toHaveAttribute('aria-current');
  });

  it('every nav item is a real link: the admin screen URL (query kept) plus the route', () => {
    mount();
    const nav = screen.getByRole('navigation', { name: 'Acme SEO' });
    expect(within(nav).getByRole('link', { name: 'Advanced' })).toHaveAttribute(
      'href',
      '/wp-admin/options-general.php?page=acme-seo#/advanced',
    );
  });

  it('a click shows the page, adds a history entry and moves focus to its heading; Back and Forward restore it', async () => {
    mount();
    const nav = screen.getByRole('navigation', { name: 'Acme SEO' });
    const before = window.history.length;

    await userEvent.click(within(nav).getByRole('link', { name: 'Advanced' }));
    const heading = screen.getByRole('heading', { level: 1, name: 'Advanced' });
    expect(heading).toHaveFocus();
    expect(window.location.hash).toBe('#/advanced');
    expect(window.location.search).toBe('?page=acme-seo');
    expect(window.history.length).toBe(before + 1);
    expect(within(nav).getByRole('link', { name: 'Advanced' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    act(() => window.history.back());
    await screen.findByRole('heading', { level: 1, name: 'General' });
    expect(within(nav).getByRole('link', { name: 'General' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    act(() => window.history.forward());
    await screen.findByRole('heading', { level: 1, name: 'Advanced' });
  });

  it('a modified click (new tab, new window) is left to the browser', () => {
    mount();
    const link = within(screen.getByRole('navigation', { name: 'Acme SEO' })).getByRole('link', {
      name: 'Advanced',
    });
    let preventedByApp: boolean | null = null;
    const record = (event: Event) => {
      preventedByApp = event.defaultPrevented;
      event.preventDefault(); // stop jsdom from really following the link after this test
    };
    document.addEventListener('click', record); // runs after React's root listener
    fireEvent.click(link, { ctrlKey: true });
    document.removeEventListener('click', record);
    expect(preventedByApp).toBe(false);
    expect(screen.getByRole('heading', { level: 1, name: 'General' })).toBeInTheDocument();
  });

  it('a deep link opens that page and tab; a hand-edited hash is followed', async () => {
    window.history.replaceState(
      null,
      '',
      '/wp-admin/options-general.php?page=acme-seo#/advanced/debug',
    );
    mount();
    expect(screen.getByRole('tab', { name: /Debugging/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Debugging' })).toBeInTheDocument();

    act(() => {
      window.location.hash = '#/general'; // the browser fires `hashchange`
    });
    await screen.findByRole('heading', { level: 1, name: 'General' });
    expect(screen.queryByRole('tablist')).toBeNull();

    // a hand-edited hash that names nothing: the first page, and the URL is corrected in place
    const before = window.history.length;
    act(() => {
      window.location.hash = '#/nope';
    });
    await waitFor(() => expect(window.location.hash).toBe('#/general'));
    expect(window.history.length).toBe(before + 1); // only the browser's own entry for the edit
  });

  it('an unknown page in the URL shows the first page and corrects the URL in place (no extra history entry)', () => {
    window.history.replaceState(null, '', '/wp-admin/options-general.php?page=acme-seo#/gone/away');
    const before = window.history.length;
    mount();
    expect(screen.getByRole('heading', { level: 1, name: 'General' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/general');
    expect(window.history.length).toBe(before);
  });

  it('utility links: the sidebar footer, and header links as Page Header actions — links, opening a new tab, said so', () => {
    mount();
    const footer = screen.getByRole('navigation', { name: 'Resources' });
    const docs = within(footer).getByRole('link', { name: 'Documentation (opens in a new tab)' });
    expect(docs).toHaveAttribute('href', 'https://acme.test/docs');
    expect(docs).toHaveAttribute('target', '_blank');
    expect(docs).toHaveAttribute('rel', 'noopener noreferrer');

    const header = document.querySelector('[data-slot=fy-page-header]') as HTMLElement;
    const changelog = within(header).getByRole('link', { name: 'Changelog (opens in a new tab)' });
    expect(changelog).not.toHaveAttribute('role'); // a link, not a button
    expect(changelog.querySelector('svg')).toHaveAttribute('data-fyldo-icon', 'exportsquare');
  });
});

describe('tabs (sub-pages)', () => {
  it('a tablist named by the page; a section without a tab shows on every tab', async () => {
    window.history.replaceState(null, '', '/wp-admin/options-general.php?page=acme-seo#/advanced');
    mount();
    const list = screen.getByRole('tablist', { name: 'Advanced' });
    expect(
      within(list)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['Cache', 'Debugging2']);
    expect(screen.getByRole('region', { name: 'Page cache' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Debugging' })).toBeNull();
    expect(screen.getByRole('region', { name: 'About these settings' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /Debugging/ }));
    expect(window.location.hash).toBe('#/advanced/debug');
    expect(screen.getByRole('region', { name: 'Debugging' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Page cache' })).toBeNull();
    expect(screen.getByRole('region', { name: 'About these settings' })).toBeInTheDocument();
  });

  it('manual activation: arrows move focus only, Enter opens the tab (it is a sub-page with its own URL)', async () => {
    window.history.replaceState(null, '', '/wp-admin/options-general.php?page=acme-seo#/advanced');
    mount();
    const cache = screen.getByRole('tab', { name: 'Cache' });
    const debug = screen.getByRole('tab', { name: /Debugging/ });
    act(() => cache.focus());
    await userEvent.keyboard('{ArrowRight}');
    expect(debug).toHaveFocus();
    expect(cache).toHaveAttribute('aria-selected', 'true');
    expect(window.location.hash).toBe('#/advanced');

    await userEvent.keyboard('{Enter}');
    expect(debug).toHaveAttribute('aria-selected', 'true');
    expect(window.location.hash).toBe('#/advanced/debug');
  });

  it('RTL: ArrowLeft goes to the next tab (reading order runs right to left)', async () => {
    window.history.replaceState(null, '', '/wp-admin/options-general.php?page=acme-seo#/advanced');
    mount({ dir: 'rtl', locale: 'fa-IR' });
    act(() => screen.getByRole('tab', { name: 'Cache' }).focus());
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /Debugging/ })).toHaveFocus();
  });

  it('values survive switching tabs, and a failed save opens the tab of the first invalid field and focuses it', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    const savePage = vi.fn(async () => ({ values: advanced.values, revision: 'rev-2' }));
    function Harness() {
      const [tab, setTab] = useState('debug');
      return <SettingsPage page={advancedGlobal} api={{ savePage, readPage: vi.fn(), runAction: vi.fn() }} tab={tab} onTabChange={setTab} />;
    }
    render(
      <PortalContainerContext.Provider value={root}>
        <Harness />
      </PortalContainerContext.Provider>,
    );
    const prefix = screen.getByRole('textbox', { name: 'Log file prefix' });
    await userEvent.clear(prefix);
    await userEvent.type(prefix, 'Not Valid');
    await userEvent.click(screen.getByRole('tab', { name: 'Cache' }));
    await userEvent.click(screen.getByRole('tab', { name: /Debugging/ }));
    expect(screen.getByRole('textbox', { name: 'Log file prefix' })).toHaveValue('Not Valid'); // kept

    await userEvent.click(screen.getByRole('tab', { name: 'Cache' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Log file prefix' })).toHaveFocus(),
    );
    expect(screen.getByRole('tab', { name: /Debugging/ })).toHaveAttribute('aria-selected', 'true');
    expect(savePage).not.toHaveBeenCalled();
  });
});

describe('top navigation layout', () => {
  it('pages are links (aria-current), not tabs; the utilities sit top-right and the Page Header shows no actions', () => {
    mount({ navigation: 'top' });
    const nav = screen.getByRole('navigation', { name: 'Acme SEO' });
    expect(within(nav).queryByRole('tab')).toBeNull();
    expect(within(nav).getByRole('link', { name: 'General' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Advanced' })).toHaveAttribute(
      'href',
      '/wp-admin/options-general.php?page=acme-seo#/advanced',
    );
    const utilities = screen.getByRole('list', { name: 'Resources' });
    expect(
      within(utilities)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Documentation (opens in a new tab)', 'Changelog (opens in a new tab)']);
    expect(document.querySelector('[data-slot=fy-page-header-actions]')).toBeNull();
  });

  it('navigates like the sidebar', async () => {
    mount({ navigation: 'top' });
    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Acme SEO' })).getByRole('link', {
        name: 'Advanced',
      }),
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Advanced' })).toHaveFocus();
    expect(window.location.hash).toBe('#/advanced');
  });
});

describe('skip link', () => {
  it.each(['sidebar', 'top'] as const)('%s layout: the first Tab stop; Enter focuses the page heading and leaves the route alone', async (navigation) => {
    mount({ navigation });
    await userEvent.tab();
    const skip = screen.getByRole('link', { name: 'Skip to page content' });
    expect(skip).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('heading', { level: 1, name: 'General' })).toHaveFocus();
    expect(window.location.hash).toBe('');
  });

  it('is translated', () => {
    setLocaleData({ locale_data: { messages: { '': { domain: 'fyldo', lang: 'fa_IR' }, 'Skip to page content': ['پرش به محتوای صفحه'] } } });
    mount();
    expect(screen.getByRole('link', { name: 'پرش به محتوای صفحه' })).toBeInTheDocument();
  });
});

describe('at 782px and below', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(max-width: 782px)',
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });

  it('the Sidebar becomes a "Menu" disclosure; picking a page closes it', async () => {
    mount();
    expect(screen.queryByRole('navigation', { name: 'Acme SEO' })).toBeNull();
    const menu = screen.getByRole('button', { name: 'Menu' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    const nav = screen.getByRole('navigation', { name: 'Acme SEO' });
    expect(document.getElementById(menu.getAttribute('aria-controls') as string)).toContainElement(
      nav,
    );

    await userEvent.click(within(nav).getByRole('link', { name: 'Advanced' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Advanced' })).toHaveFocus();
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: 'Acme SEO' })).toBeNull();
  });
});

describe('Persian', () => {
  it('badges and the version use Persian numerals; the version drops the "v" as translated', () => {
    const jed = JSON.parse(
      readFileSync(resolve(__dirname, '../../languages/fyldo-fa_IR.json'), 'utf8'),
    );
    setLocaleData(jed);
    mount({ dir: 'rtl', locale: 'fa-IR', version: '1.0' });
    const nav = screen.getByRole('navigation', { name: 'Acme SEO' });
    expect(within(nav).getByRole('link', { name: /Content/ })).toHaveTextContent('Content۳');
    expect(document.querySelector('[data-slot=fy-brand] [data-slot=fy-badge]')).toHaveTextContent(
      /^۱٫۰$/,
    );
    expect(screen.getByRole('navigation', { name: 'منابع' })).toBeInTheDocument();
  });
});

describe('brand', () => {
  const brand = () => document.querySelector('[data-slot=fy-sidebar] [data-slot=fy-brand], [data-slot=fy-brand]') as HTMLElement;

  it('without a logo draws the Fyldo mark (decorative, currentColor) before the name', () => {
    mount({ logo: null });
    const mark = brand().querySelector('[data-slot=fy-fyldo-mark]') as SVGElement;
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(mark.querySelector('path')).toHaveAttribute('fill', 'currentColor');
    expect(brand().firstElementChild).toBe(mark);
  });

  it('an icon logo is the Iconsax icon at 24px', () => {
    mount({ logo: { icon: 'setting-2' } });
    const icon = brand().querySelector('svg') as SVGElement;
    expect(icon).toHaveAttribute('data-fyldo-icon', 'setting2');
    expect(icon).toHaveAttribute('width', '24');
    expect(brand().querySelector('[data-slot=fy-fyldo-mark]')).toBeNull();
  });

  it('an image logo is a 24×24 image with an empty alt (the name beside it names the brand)', () => {
    mount({ logo: { url: 'https://acme.test/logo.svg' } });
    const img = brand().querySelector('img') as HTMLImageElement;
    expect(img).toHaveAttribute('src', 'https://acme.test/logo.svg');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('width', '24');
    expect(img).toHaveAttribute('height', '24');
    expect(within(brand()).getByText('Acme SEO')).toBeInTheDocument();
  });
});
