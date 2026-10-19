/**
 * Custom pages: the plugin's module draws a whole page in Fyldo's content column. Routes with paths, the module's props
 * (both the React and the plain DOM path), failures that stay inside the page, navigation within the page and the
 * unsaved-changes guard across paths and pages (setDirty and a <Form> on the page).
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/components/fyldo/App';
import { defineCustomPage, collectPageModules, type CustomPageProps } from '../../app/lib/custom-pages';
import { collectCustomModules, customFieldApi } from '../../app/lib/custom-fields';
import { parseHash, resolveRoute, routeHash } from '../../app/lib/router';
import { sdk, type FyldoSdk } from '../../app/lib/sdk';
import type { CustomFieldDef, CustomPageDef, FieldValue, FyldoConfig, PageDef } from '../../app/types';

const fixture = (name: string) => JSON.parse(readFileSync(resolve(__dirname, `../fixtures/${name}.client.json`), 'utf8')) as PageDef;
const general = fixture('slice-page');

const custom = (id: string, title: string, module: string): CustomPageDef => ({
  type: 'custom',
  id,
  title,
  description: `${title} of the site.`,
  icon: 'notification',
  group: '',
  badge: '',
  module,
  props: { add: 'New announcement' },
});
const announcements = custom('announcements', 'Announcements', '/test/announcements.js');
const stats = custom('stats', 'Statistics', '/test/stats.js');
const broken = custom('broken', 'Broken', '/test/never-loaded.js');
const crashing = custom('crashing', 'Crashing', '/test/crashing.js');
const pages = [general, announcements, stats, broken, crashing];

/** Every set of props the React page was rendered with. */
const seen: CustomPageProps[] = [];

defineCustomPage('/test/announcements.js', ({ ui, Form }: FyldoSdk) => ({
  Component: function Announcements(props: CustomPageProps) {
    seen.push(props);
    const { path, navigate, setDirty, headingRef, page, request, toast } = props;
    if (path[0]) {
      return (
        <>
          <ui.PageHeader title={path[0] === 'new' ? 'New announcement' : `Announcement ${path.join(' / ')}`} headingRef={headingRef} />
          <ui.Button onClick={() => navigate([])}>All announcements</ui.Button>
          <Form form="announcement" record={path[0]} onSaved={(key) => navigate([key], { replace: true })} />
        </>
      );
    }
    return (
      <>
        <ui.PageHeader title={page.title} description={page.description} headingRef={headingRef} />
        <ui.Button onClick={() => navigate('new')}>{String(props.props.add)}</ui.Button>
        <ui.Button onClick={() => navigate('42/edit')}>Edit 42</ui.Button>
        <ui.Button onClick={() => setDirty(true)}>Start a draft</ui.Button>
        <ui.Button onClick={() => setDirty(false)}>Drop the draft</ui.Button>
        <ui.Button onClick={() => void request<{ count: number }>('acme/v1/stats', { query: { range: 7 } }).then((r) => toast.success(`${r.count} visits`))}>Load stats</ui.Button>
      </>
    );
  },
}));

const calls: string[] = [];
defineCustomPage('/test/stats.js', {
  mount(element: HTMLElement, props: CustomPageProps) {
    calls.push(`mount:${props.path.join('/')}`);
    element.innerHTML = '<p>Plain DOM statistics</p><button type="button">Week</button>';
    element.querySelector('button')?.addEventListener('click', () => props.navigate(['week']));
    return {
      update: (next: CustomPageProps) => calls.push(`update:${next.path.join('/')}`),
      destroy: () => calls.push('destroy'),
    };
  },
});

defineCustomPage('/test/crashing.js', {
  Component: () => {
    throw new Error('boom');
  },
});

function config(overrides: Partial<FyldoConfig> = {}): FyldoConfig {
  return {
    slug: 'acme',
    title: 'Acme',
    logo: null,
    version: '',
    fyldoVersion: '1.0.0',
    navigation: 'sidebar',
    groups: [],
    links: [],
    notices: [],
    pages,
    forms: [{ id: 'announcement', sections: general.sections }],
    dir: 'ltr',
    locale: 'en',
    rootId: 'fyldo-acme-root',
    rest: { base: '/rest/', root: '/rest/fyldo-acme/v1/', nonce: 'n', instanceNonce: 'i', nonceHeader: 'X-Fyldo-Nonce', refresh: '/wp-admin/admin-ajax.php?action=fyldo_acme_nonces' },
    i18n: null,
    ...overrides,
  };
}

const requests: Array<{ url: string; method: string; body: Record<string, unknown> | null }> = [];

function mount(hash = '#/announcements') {
  window.history.replaceState(null, '', `/wp-admin/admin.php?page=acme${hash}`);
  requests.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
      requests.push({ url, method: init.method ?? 'GET', body });
      const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
      if (url === '/rest/acme/v1/stats?range=7') return json({ count: 12 });
      const record = /records\/([^/?]+)$/.exec(url)?.[1] ?? '';
      if (init.method === 'POST') return json({ key: record === 'new' ? '43' : record, values: { ...general.values, ...(body?.values as Record<string, FieldValue>) }, revision: 'r2' });
      return json(record === 'new' ? { key: '', values: { ...general.values, site_title: '' }, revision: '' } : { key: record, values: general.values, revision: 'r1' });
    }),
  );
  const root = document.createElement('div');
  document.body.append(root);
  return render(<App config={config()} root={root} />);
}

const nav = () => screen.getByRole('navigation', { name: 'Acme' });
const h1 = () => screen.getByRole('heading', { level: 1 });
const fireUnload = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

beforeEach(() => {
  seen.length = 0;
  calls.length = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('routes of a custom page', () => {
  it('every segment after the page id is its path (decoded); a settings page keeps its tabs', () => {
    expect(resolveRoute(pages, parseHash('#/announcements/42/edit'))).toEqual({ page: 'announcements', tab: '', path: ['42', 'edit'] });
    expect(resolveRoute(pages, parseHash('#/announcements/a%2Fb'))).toEqual({ page: 'announcements', tab: '', path: ['a/b'] });
    expect(resolveRoute(pages, parseHash('#/announcements'))).toEqual({ page: 'announcements', tab: '', path: [] });
    expect(resolveRoute(pages, parseHash('#/general/x/y'))).toEqual({ page: 'general', tab: '', path: [] });
    // an unknown page falls back to the first, without the path
    expect(resolveRoute(pages, parseHash('#/nope/42'))).toEqual({ page: 'general', tab: '', path: [] });
  });

  it('routeHash encodes the path back', () => {
    expect(routeHash(pages, { page: 'announcements', tab: '', path: ['42', 'edit'] })).toBe('#/announcements/42/edit');
    expect(routeHash(pages, { page: 'announcements', tab: '', path: ['a/b', 'é'] })).toBe('#/announcements/a%2Fb/%C3%A9');
    expect(routeHash(pages, { page: 'announcements', tab: '', path: [] })).toBe('#/announcements');
  });

  it('a deep link opens the path; a settings page’s extra segments are corrected away', async () => {
    mount('#/announcements/42/edit');
    expect(h1()).toHaveTextContent('Announcement 42 / edit');
    expect(seen.at(-1)?.path).toEqual(['42', 'edit']);
    expect(window.location.hash).toBe('#/announcements/42/edit');

    act(() => {
      window.location.hash = '#/general/x';
    });
    await waitFor(() => expect(window.location.hash).toBe('#/general'));
  });
});

describe('a custom page', () => {
  it('draws its module in the content column with its props; the nav item is current', () => {
    mount();
    const column = h1().closest('[data-slot="fy-content"]');
    expect(column).toHaveAttribute('data-page', 'custom');
    expect(column).toHaveClass('fy:max-w-256', 'fy:pt-10', 'fy:px-8');
    expect(within(nav()).getByRole('link', { name: 'Announcements' })).toHaveAttribute('aria-current', 'page');

    const props = seen.at(-1)!;
    expect(props.page).toEqual({ id: 'announcements', title: 'Announcements', description: 'Announcements of the site.', icon: 'notification' });
    expect(props).toMatchObject({ path: [], props: { add: 'New announcement' }, locale: 'en', dir: 'ltr' });
    expect(screen.getByRole('button', { name: 'New announcement' })).toBeVisible();
  });

  it('navigate() shows another path: a history entry, focus on the new h1; Back returns', async () => {
    mount();
    const before = window.history.length;
    await userEvent.click(screen.getByRole('button', { name: 'Edit 42' }));
    expect(window.location.hash).toBe('#/announcements/42/edit');
    expect(window.history.length).toBe(before + 1);
    await waitFor(() => expect(h1()).toHaveTextContent('Announcement 42 / edit'));
    expect(h1()).toHaveFocus();

    act(() => window.history.back());
    await waitFor(() => expect(h1()).toHaveTextContent('Announcements'));
    await waitFor(() => expect(h1()).toHaveFocus());
  });

  it('its navigate, setDirty and headingRef stay the same function across renders', async () => {
    mount();
    const first = seen.at(-1)!;
    await userEvent.click(screen.getByRole('button', { name: 'Edit 42' }));
    const last = seen.at(-1)!;
    expect(last.navigate).toBe(first.navigate);
    expect(last.setDirty).toBe(first.setDirty);
    expect(last.headingRef).toBe(first.headingRef);
  });

  it('request() calls the plugin’s route under the REST root; toast shows in Fyldo’s stack', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Load stats' }));
    expect(await screen.findByText('12 visits')).toBeInTheDocument();
    expect(requests.at(-1)).toMatchObject({ url: '/rest/acme/v1/stats?range=7', method: 'GET' });
  });
});

describe('the unsaved-changes guard on a custom page', () => {
  it('setDirty(true): another path asks; Keep editing stays', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Start a draft' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit 42' }));
    const dialog = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    expect(window.location.hash).toBe('#/announcements');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(h1()).toHaveTextContent('Announcements');
    expect(fireUnload()).toBe(true);
  });

  it('Discard clears the flag and goes; then nothing asks', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Start a draft' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit 42' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(h1()).toHaveTextContent('Announcement 42 / edit'));
    expect(window.location.hash).toBe('#/announcements/42/edit');
    expect(fireUnload()).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'All announcements' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.hash).toBe('#/announcements');
  });

  it('another page asks too, and so does Back; a cleared flag leaves without asking', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Start a draft' }));
    await userEvent.click(within(nav()).getByRole('link', { name: 'General' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    act(() => {
      window.history.replaceState(null, '', '#/general');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await screen.findByRole('dialog');
    expect(window.location.hash).toBe('#/announcements');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await userEvent.click(screen.getByRole('button', { name: 'Drop the draft' }));
    expect(fireUnload()).toBe(false);
    await userEvent.click(within(nav()).getByRole('link', { name: 'General' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h1()).toHaveTextContent('General');
  });

  it('a Form on the page registers itself: edits ask before leaving the path, Discard drops them', async () => {
    mount('#/announcements/42');
    const title = await screen.findByRole('textbox', { name: 'Site title' });
    await waitFor(() => expect(title).toHaveValue('Fyldo'));
    await userEvent.type(title, '!');
    expect(fireUnload()).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'All announcements' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(h1()).toHaveTextContent('Announcements'));
    expect(fireUnload()).toBe(false);
  });

  it('creating a record: the page moves to its key in place, without asking and without reloading it', async () => {
    mount('#/announcements/new');
    const title = await screen.findByRole('textbox', { name: 'Site title' });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Tagline' })).toHaveValue(general.values.tagline as string));
    await userEvent.type(title, 'Hello');
    const entries = window.history.length;
    await userEvent.click(within(screen.getByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(window.location.hash).toBe('#/announcements/43'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.history.length).toBe(entries); // replaced
    expect(h1()).toHaveTextContent('Announcement 43');
    expect(screen.getByRole('textbox', { name: 'Site title' })).toHaveValue('Hello');
    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual(['GET /rest/fyldo-acme/v1/forms/announcement/records/new', 'POST /rest/fyldo-acme/v1/forms/announcement/records/new']);
    expect(requests[1]?.body).toEqual({ values: { ...general.values, site_title: 'Hello' }, revision: '' });
  });
});

describe('a plain DOM page (mount)', () => {
  it('mounts once, updates on a new path, is destroyed when the page goes; focus falls back to the column', async () => {
    mount('#/general');
    await userEvent.click(within(nav()).getByRole('link', { name: 'Statistics' }));
    expect(screen.getByText('Plain DOM statistics')).toBeVisible();
    const column = screen.getByText('Plain DOM statistics').closest<HTMLElement>('[data-slot="fy-content"]');
    await waitFor(() => expect(column).toHaveFocus()); // no headingRef on an h1

    await userEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(window.location.hash).toBe('#/stats/week');
    expect(calls.filter((c) => c.startsWith('mount'))).toEqual(['mount:']);
    expect(calls).toContain('update:week');

    await userEvent.click(within(nav()).getByRole('link', { name: 'General' }));
    expect(calls.at(-1)).toBe('destroy');
    expect(screen.queryByText('Plain DOM statistics')).toBeNull();
  });
});

describe('failures stay inside the page', () => {
  it('a module that could not be loaded: its title and a red Notice; the navigation still works', async () => {
    mount('#/broken');
    expect(h1()).toHaveTextContent('Broken');
    expect(screen.getByText('This page couldn’t be loaded.')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Error' })).toBeInTheDocument();
    await userEvent.click(within(nav()).getByRole('link', { name: 'General' }));
    expect(h1()).toHaveTextContent('General');
  });

  it('a component that throws is caught and reported', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mount('#/crashing');
    expect(screen.getByText('This page couldn’t be loaded.')).toBeVisible();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('custom page "crashing" crashed'), expect.anything(), expect.anything());
    error.mockRestore();
  });

  it('a module that gives neither Component nor mount is reported and not used', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    defineCustomPage('/test/empty.js', () => ({}));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('custom page module "/test/empty.js" is not usable'));
    error.mockRestore();
  });
});

describe('the SDK', () => {
  it('one object for fields and pages: v1 keeps the field API and adds the page building blocks', () => {
    expect(customFieldApi).toBe(sdk);
    expect(sdk.version).toBe(1);
    expect(Object.keys(sdk.ui)).toEqual(
      expect.arrayContaining(['Button', 'Checkbox', 'Icon', 'Input', 'NumberInput', 'Select', 'Textarea', 'Toggle', 'ButtonLink', 'IconButton', 'RadioGroup', 'MultiSelect', 'SegmentedControl', 'Badge', 'Tag', 'Notice', 'EmptyState', 'Modal', 'Tooltip', 'Tabs', 'PageHeader', 'SectionCard', 'SettingRow']),
    );
    // The field controls a record editor needs, the same components Fyldo's own fields draw.
    expect(Object.keys(sdk.ui)).toEqual(expect.arrayContaining(['ColorPicker', 'DatePicker', 'TimePicker', 'DateRangePicker', 'MediaPicker', 'GroupItem', 'GroupList', 'ChoiceCards', 'CodeEditor']));
    expect(typeof sdk.Form).toBe('function');
    expect(typeof sdk.iconSvg).toBe('function');
  });

  it('collects page modules, and the custom fields of forms', () => {
    const field = { id: 'hours', type: 'custom', module: '/in-form.js' } as unknown as CustomFieldDef;
    const forms = [{ id: 'f', sections: [{ ...general.sections[0]!, fields: [field] }] }];
    expect(collectPageModules({ pages })).toEqual(['/test/announcements.js', '/test/stats.js', '/test/never-loaded.js', '/test/crashing.js']);
    expect(collectCustomModules({ pages, forms })).toEqual(['/in-form.js']);
  });
});
