import { createContext, useContext } from 'react';

/** The Fyldo root element: every popup (Select, Tooltip, Toast, Dialog) portals INSIDE it to keep tokens and scoping. */
export const PortalContainerContext = createContext<HTMLElement | null>(null);

export const usePortalContainer = (): HTMLElement | null => useContext(PortalContainerContext);

/**
 * The locale a control writes its numerals, month names and sizes in: the one it is given, else the screen's (the root's
 * `lang`, which is the page's locale), so a custom page or field gets Persian without passing it.
 */
export const useScreenLocale = (locale?: string): string => {
  const root = usePortalContainer();
  return locale ?? (root?.lang || 'en');
};
