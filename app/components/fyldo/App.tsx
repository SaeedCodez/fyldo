import { DirectionProvider } from '@base-ui/react/direction-provider';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { __, _x } from '../../i18n';
import { createApi } from '../../lib/api';
import { createToaster } from '../../lib/toast';
import { createFormStore } from '../../lib/page-form';
import { PortalContainerContext } from '../../lib/portal';
import { useRouter, type Route } from '../../lib/router';
import type { FyldoConfig } from '../../types';
import { Modal } from '../ui/modal';
import { ToastProvider } from '../ui/toast';
import { TooltipProvider } from '../ui/tooltip';
import { SettingsPage } from './SettingsPage';
import { Shell, utilityLinks } from './Shell';

export interface AppProps {
  config: FyldoConfig;
  /** The Fyldo root element: portals (Select menu, tooltips, toasts, dialogs) render inside it. */
  root: HTMLElement;
}

/** A page change waiting for the unsaved-changes dialog: from the app's navigation, or from Back/Forward. */
interface Pending {
  route: Route;
  via: 'navigate' | 'history';
}

export function App({ config, root }: AppProps): ReactElement {
  const api = useMemo(() => createApi(config), [config]);
  // Every page's form lives here, not in the page: values, revision and save status survive tab and page switches.
  const store = useMemo(() => createFormStore(config.pages), [config.pages]);
  // Toasts are queued on this manager and drawn inside the root by <ToastProvider>.
  const toaster = useMemo(() => createToaster(), []);
  // PHP notices the user dismissed (for this visit: the page is reloaded with them again, as PHP queues them).
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [pending, setPending] = useState<Pending | null>(null);
  const shownPage = useRef('');

  // Leaving a page with unsaved edits asks first. Tabs of one page share its form: switching tabs never asks.
  const leaving = useCallback(
    (next: Route): boolean => next.page !== shownPage.current && store.isDirty(shownPage.current),
    [store],
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
  const heading = useRef<HTMLHeadingElement>(null);
  const focusedPage = useRef(route.page);
  shownPage.current = route.page;

  const go = useCallback(
    (next: Route) => {
      if (leaving(next)) setPending({ route: next, via: 'navigate' });
      else navigate(next);
    },
    [leaving, navigate],
  );

  // Leaving the screen (reload, another admin page, closing the tab) with unsaved edits: the browser's own prompt.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!config.pages.some((p) => store.isDirty(p.id))) return;
      event.preventDefault();
      event.returnValue = ''; // older engines need it set
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [config.pages, store]);

  // A new page (picked in the navigation, or Back/Forward) starts at the top with focus on its h1, so keyboard and
  // screen-reader users land where the content begins. A tab change keeps focus on the tab.
  useEffect(() => {
    if (focusedPage.current === route.page) return;
    focusedPage.current = route.page;
    if (cause === 'navigate') window.scrollTo({ top: 0, behavior: 'instant' });
    heading.current?.focus({ preventScroll: true });
  }, [route.page, cause]);

  // A dismissed notice takes its focused button with it: put focus where the page begins.
  const dismissNotice = useCallback((id: string) => {
    setDismissed((current) => new Set(current).add(id));
    heading.current?.focus({ preventScroll: true });
  }, []);

  const onTabChange = useCallback(
    (tab: string) => navigate({ page: route.page, tab }),
    [navigate, route.page],
  );

  const discardAndLeave = (): void => {
    if (!pending) return;
    store.dispatch(route.page, { type: 'discard' });
    setPending(null);
    // After Back/Forward the history entry is already the one moved to: show its route in place.
    navigate(pending.route, { replace: pending.via === 'history' });
  };

  return (
    <PortalContainerContext.Provider value={root}>
      <DirectionProvider direction={config.dir}>
        <TooltipProvider>
          <ToastProvider toaster={toaster}>
            <Shell config={config} route={route} onNavigate={(id) => go({ page: id, tab: '' })}>
              {page ? (
                <SettingsPage
                  key={page.id}
                  page={page}
                  api={api}
                  store={store}
                  tab={route.tab}
                  onTabChange={onTabChange}
                  headerLinks={config.navigation === 'top' ? [] : utilityLinks(config, 'header')}
                  headingRef={heading}
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
              focusAfterConfirm={() => heading.current}
            />
          </ToastProvider>
        </TooltipProvider>
      </DirectionProvider>
    </PortalContainerContext.Provider>
  );
}
