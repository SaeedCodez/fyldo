import { DirectionProvider } from '@base-ui/react/direction-provider';
import { useCallback, useEffect, useMemo, useRef, type ReactElement } from 'react';
import { createApi } from '../../lib/api';
import { PortalContainerContext } from '../../lib/portal';
import { useRouter } from '../../lib/router';
import type { FyldoConfig } from '../../types';
import { SettingsPage } from './SettingsPage';
import { Shell, utilityLinks } from './Shell';

export interface AppProps {
  config: FyldoConfig;
  /** The Fyldo root element: portals (Select menu, tooltips, toasts, dialogs) render inside it. */
  root: HTMLElement;
}

export function App({ config, root }: AppProps): ReactElement {
  const api = useMemo(() => createApi(config), [config]);
  const { route, cause, navigate } = useRouter(config.pages);
  const page = config.pages.find((p) => p.id === route.page);
  const heading = useRef<HTMLHeadingElement>(null);
  const shownPage = useRef(route.page);

  // A new page (picked in the navigation, or Back/Forward) starts at the top with focus on its h1, so keyboard and
  // screen-reader users land where the content begins. A tab change keeps focus on the tab.
  useEffect(() => {
    if (shownPage.current === route.page) return;
    shownPage.current = route.page;
    if (cause === 'navigate') window.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [route.page, cause]);

  const onTabChange = useCallback((tab: string) => navigate({ page: route.page, tab }), [navigate, route.page]);

  return (
    <PortalContainerContext.Provider value={root}>
      <DirectionProvider direction={config.dir}>
        <Shell config={config} route={route} onNavigate={(id) => navigate({ page: id, tab: '' })}>
          {page ? (
            <SettingsPage
              // Each page owns its form: a new page starts from its own values (the unsaved-changes guard is M3 part 2).
              key={page.id}
              page={page}
              api={api}
              tab={route.tab}
              onTabChange={onTabChange}
              headerLinks={config.navigation === 'top' ? [] : utilityLinks(config, 'header')}
              headingRef={heading}
              locale={config.locale}
            />
          ) : null}
        </Shell>
      </DirectionProvider>
    </PortalContainerContext.Provider>
  );
}
