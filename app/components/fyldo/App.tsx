import { DirectionProvider } from '@base-ui/react/direction-provider';
import { useMemo, type ReactElement } from 'react';
import { createApi } from '../../lib/api';
import { PortalContainerContext } from '../../lib/portal';
import type { FyldoConfig, PageDef } from '../../types';
import { SettingsPage } from './SettingsPage';

export interface AppProps {
  config: FyldoConfig;
  /** The Fyldo root element: portals (Select menu, tooltips, toasts, dialogs) render inside it. */
  root: HTMLElement;
}

const pageFromHash = (pages: PageDef[]): PageDef | undefined => {
  const id = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  return pages.find((p) => p.id === id) ?? pages[0];
};

export function App({ config, root }: AppProps): ReactElement {
  const api = useMemo(() => createApi(config), [config]);
  const page = pageFromHash(config.pages);

  return (
    <PortalContainerContext.Provider value={root}>
      <DirectionProvider direction={config.dir}>
        {page ? <SettingsPage key={page.id} page={page} api={api} /> : null}
      </DirectionProvider>
    </PortalContainerContext.Provider>
  );
}
