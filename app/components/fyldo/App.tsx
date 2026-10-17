import { DirectionProvider } from '@base-ui/react/direction-provider';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { __, _x } from '../../i18n';
import { createApi } from '../../lib/api';
import { createDirtyRegistry } from '../../lib/dirty';
import { FormHostContext, type FormHost } from '../../lib/host';
import { createToaster } from '../../lib/toast';
import { createFormStore } from '../../lib/page-form';
import { PortalContainerContext } from '../../lib/portal';
import { samePath, useRouter, type Route } from '../../lib/router';
import { isCustomPage, isSettingsPage, type FyldoConfig } from '../../types';
import { Modal } from '../ui/modal';
import { ToastProvider } from '../ui/toast';
import { TooltipProvider } from '../ui/tooltip';
import { CustomPage } from './CustomPage';
import { SettingsPage } from './SettingsPage';
import { Shell, utilityLinks } from './Shell';

export interface AppProps {
  config: FyldoConfig;
  /** The Fyldo root element: portals (Select menu, tooltips, toasts, dialogs) render inside it. */
  root: HTMLElement;
}

/** A page or path change waiting for the unsaved-changes dialog: from the app's navigation, or from Back/Forward. */
interface Pending {
  route: Route;
  via: 'navigate' | 'history';
  replace?: boolean;
}

/** What identifies a shown screen for focus: its page and (custom page) its path. Tabs are not screens of their own. */
const screenKey = (route: Route): string => [route.page, ...route.path].join('\u0000');

export function App({ config, root }: AppProps): ReactElement {
  const api = useMemo(() => createApi(config), [config]);
  // Every settings page's form lives here, not in the page: values, revision and save status survive tab and page switches.
  const store = useMemo(() => createFormStore(config.pages.filter(isSettingsPage)), [config.pages]);
  // What custom pages report as unsaved (their own state, and every <Form> on them).
  const dirty = useMemo(() => createDirtyRegistry(), []);
  const host = useMemo<FormHost>(() => ({ forms: config.forms ?? [], api, locale: config.locale }), [config.forms, config.locale, api]);
  // Toasts are queued on this manager and drawn inside the root by <ToastProvider>.
  const toaster = useMemo(() => createToaster(), []);
  // PHP notices the user dismissed (for this visit: the page is reloaded with them again, as PHP queues them).
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [pending, setPending] = useState<Pending | null>(null);
  const shown = useRef<Route>({ page: '', tab: '', path: [] });

  const isDirty = useCallback((page: string): boolean => store.isDirty(page) || dirty.isDirty(page), [store, dirty]);

  // Leaving a page with unsaved edits asks first, and so does another path of a custom page (another record, say). Tabs
  // of a settings page share its form: switching tabs never asks.
  const leaving = useCallback(
    (next: Route): boolean => (next.page !== shown.current.page || !samePath(next.path, shown.current.path)) && isDirty(shown.current.page),
    [isDirty],
  );
  const guard = useCallback(
    (next: Route): boolean => {
      if (!leaving(next)) return true;
      setPending({ route: next, via: 'history' });
      return false;
    },
    [leaving],
  );

  const { route, cause, navigate } = useRouter(config.pages, guard);
  const page = config.pages.find((p) => p.id === route.page);
  // The shown page's h1 (a custom page sets it through its `headingRef`).
  const heading = useRef<HTMLElement | null>(null);
  const setHeading = useCallback((element: HTMLHeadingElement | null) => {
    heading.current = element;
  }, []);
  // A custom page's column: where the page begins when the page puts no `headingRef` on its h1.
  const column = useRef<HTMLDivElement>(null);
  const focusedScreen = useRef(screenKey(route));
  shown.current = route;

  const go = useCallback(
    (next: Route, options?: { replace?: boolean }) => {
      if (leaving(next)) setPending({ route: next, via: 'navigate', replace: options?.replace });
      else navigate(next, options);
    },
    [leaving, navigate],
  );

  // Leaving the screen (reload, another admin page, closing the tab) with unsaved edits: the browser's own prompt.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!config.pages.some((p) => isDirty(p.id))) return;
      event.preventDefault();
      event.returnValue = ''; // older engines need it set
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [config.pages, isDirty]);

  // Where the page begins: its h1, or (a custom page without a `headingRef` on its h1) the content column.
  const start = useCallback((): HTMLElement | null => (heading.current?.isConnected ? heading.current : column.current), []);
  const focusStart = useCallback(() => start()?.focus({ preventScroll: true }), [start]);

  // A new page or path (picked in the navigation, by the page itself, or Back/Forward) starts at the top with focus on its
  // h1, so keyboard and screen-reader users land where the content begins. A tab change keeps focus on the tab.
  const screen = screenKey(route);
  useEffect(() => {
    if (focusedScreen.current === screen) return;
    focusedScreen.current = screen;
    if (cause === 'navigate') {
      // The content area scrolls inside the shell on desktop (a custom scrollbar); on phones the document does.
      root.querySelector<HTMLElement>('[data-slot=fy-main]')?.scrollTo?.({ top: 0, behavior: 'instant' });
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    focusStart();
  }, [screen, cause, root, focusStart]);

  // A dismissed notice takes its focused button with it: put focus where the page begins.
  const dismissNotice = useCallback(
    (id: string) => {
      setDismissed((current) => new Set(current).add(id));
      focusStart();
    },
    [focusStart],
  );

  const onTabChange = useCallback(
    (tab: string) => navigate({ page: route.page, tab, path: [] }),
    [navigate, route.page],
  );
  const pageNavigate = useCallback(
    (path: string[], options?: { replace?: boolean }) => go({ page: route.page, tab: '', path }, options),
    [go, route.page],
  );

  const discardAndLeave = (): void => {
    if (!pending) return;
    store.dispatch(route.page, { type: 'discard' });
    dirty.discard(route.page);
    setPending(null);
    // After Back/Forward the history entry is already the one moved to: show its route in place.
    navigate(pending.route, { replace: pending.via === 'history' || pending.replace });
  };

  return (
    <PortalContainerContext.Provider value={root}>
      <DirectionProvider direction={config.dir}>
        <TooltipProvider>
          <ToastProvider toaster={toaster}>
            <Shell config={config} route={route} onNavigate={(id) => go({ page: id, tab: '', path: [] })}>
              {page && isCustomPage(page) ? (
                <FormHostContext.Provider value={host}>
                  <CustomPage
                    key={page.id}
                    page={page}
                    path={route.path}
                    locale={config.locale}
                    dir={config.dir}
                    navigate={pageNavigate}
                    request={api.request}
                    toaster={toaster}
                    dirty={dirty}
                    heading={heading}
                    column={column}
                  />
                </FormHostContext.Provider>
              ) : page ? (
                <SettingsPage
                  key={page.id}
                  page={page}
                  api={api}
                  store={store}
                  tab={route.tab}
                  onTabChange={onTabChange}
                  headerLinks={config.navigation === 'top' ? [] : utilityLinks(config, 'header')}
                  headingRef={setHeading}
                  locale={config.locale}
                  notices={(config.notices ?? []).filter(
                    (n) => (n.page === '' || n.page === page.id) && !dismissed.has(n.id),
                  )}
                  onDismissNotice={dismissNotice}
                />
              ) : null}
            </Shell>
            <Modal
              open={pending !== null}
              onOpenChange={(open) => {
                if (!open) setPending(null);
              }}
              title={__('Discard unsaved changes?', 'fyldo')}
              description={__(
                'Your edits on this page haven’t been saved and will be lost.',
                'fyldo',
              )}
              cancelLabel={__('Keep editing', 'fyldo')}
              confirmLabel={_x('Discard', 'unsaved changes dialog', 'fyldo')}
              onConfirm={discardAndLeave}
              focusAfterConfirm={start}
            />
          </ToastProvider>
        </TooltipProvider>
      </DirectionProvider>
    </PortalContainerContext.Provider>
  );
}
