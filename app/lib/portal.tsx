import { createContext, useContext } from 'react';

/** The Fyldo root element: every popup (Select, Tooltip, Toast, Dialog) portals INSIDE it to keep tokens and scoping. */
export const PortalContainerContext = createContext<HTMLElement | null>(null);

export const usePortalContainer = (): HTMLElement | null => useContext(PortalContainerContext);
