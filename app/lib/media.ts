import { useSyncExternalStore } from 'react';

/** wp-admin goes "mobile" at this width and below (46px admin bar, the side menu becomes an overlay). */
export const WP_MOBILE = '(max-width: 782px)';

/** Whether a media query matches, kept current. `false` where `matchMedia` does not exist (tests, old engines). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
    () => false,
  );
}
