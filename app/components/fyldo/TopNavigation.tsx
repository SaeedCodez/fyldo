import { Fragment, useCallback, useEffect, useRef, useState, type MouseEvent, type ReactElement } from 'react';
import { __ } from '../../i18n';
import { cn } from '../../lib/cn';
import { ButtonLink } from '../ui/button';
import { BrandMark } from './BrandMark';
import type { Brand, NavGroup, UtilityLink } from './nav-model';
import { isPlainClick } from './NavItem';
import { TAB_OUTER, TabLook } from './Tab';

export interface TopNavigationProps {
  brand: Brand;
  groups: NavGroup[];
  /** Utility links top-right (Tertiary Small buttons with a leading icon). */
  links?: UtilityLink[];
  locale?: string;
  onNavigate?: (pageId: string, event: MouseEvent<HTMLAnchorElement>) => void;
}

/** Which edges of a horizontally scrolling element have more to show (logical: the same in LTR and RTL, where `scrollLeft` counts down). */
function useScrollEdges() {
  const ref = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const position = Math.abs(el.scrollLeft);
    const max = el.scrollWidth - el.clientWidth;
    setEdges((before) => {
      const next = { start: position > 1, end: position < max - 1 };
      return before.start === next.start && before.end === next.end ? before : next;
    });
  }, []);
  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);
  return { ref, edges, measure };
}

/*
 * Figma Top Navigation: full width, background/default, 1px bottom divider (border/default), two 48px rows.
 *   Header      padding 12/24/4/24, gap 16: brand · spacer · utilities (Tertiary Small buttons, leading icon, gap 4)
 *   Navigation  padding 0/12, gap 4: the Tab look with icons, as LINKS (aria-current), not a tablist; groups are
 *               separated by a 1×16 divider centred in a 17px slot instead of labels.
 * At ≤782px (design silent) the utilities wrap under the brand and the navigation row scrolls sideways, fading out at
 * an edge that has more to show (app.css).
 */
export function TopNavigation({
  brand,
  groups,
  links = [],
  locale = 'en',
  onNavigate,
}: TopNavigationProps): ReactElement {
  const { ref: navRef, edges, measure } = useScrollEdges();
  return (
    <div data-slot="fy-top-nav" className="fy:relative fy:w-full fy:bg-background-default">
      <span
        aria-hidden="true"
        className="fy:absolute fy:inset-x-0 fy:bottom-0 fy:h-px fy:bg-border-default"
      />
      <div
        data-slot="fy-top-nav-header"
        className="fy:flex fy:min-h-12 fy:items-center fy:gap-4 fy:px-6 fy:pt-3 fy:pb-1 fy:wp-mobile:flex-wrap"
      >
        <BrandMark brand={brand} locale={locale} />
        <span className="fy:flex-1" />
        {links.length > 0 ? (
          <ul
            aria-label={__('Resources', 'fyldo')}
            data-slot="fy-top-nav-utilities"
            className="fy:flex fy:items-center fy:gap-1"
          >
            {links.map((link) => (
              <li key={link.href}>
                <ButtonLink
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  variant="tertiary"
                  size="sm"
                  leadingIcon={link.icon || undefined}
                >
                  {link.label}
                  {link.external ? (
                    <>
                      {' '}
                      <span className="fy:sr-only">{__('(opens in a new tab)', 'fyldo')}</span>
                    </>
                  ) : null}
                </ButtonLink>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <nav
        ref={navRef}
        aria-label={brand.name}
        data-slot="fy-top-nav-nav"
        data-fade-start={edges.start ? '' : undefined}
        data-fade-end={edges.end ? '' : undefined}
        onScroll={measure}
        className="fy:flex fy:gap-1 fy:px-3 fy:wp-mobile:overflow-x-auto"
      >
        {groups.map((group, index) => (
          <Fragment key={group.id}>
            {index > 0 ? (
              <span
                aria-hidden="true"
                data-slot="fy-top-nav-divider"
                className="fy:flex fy:w-4.25 fy:shrink-0 fy:items-center fy:justify-center fy:self-stretch"
              >
                <span className="fy:h-4 fy:w-px fy:bg-border-default" />
              </span>
            ) : null}
            <ul aria-label={group.label || undefined} className="fy:flex fy:gap-1">
              {group.items.map((item) => (
                <li key={item.id} className="fy:flex">
                  <a
                    href={item.href}
                    aria-current={item.active ? 'page' : undefined}
                    data-slot="fy-top-nav-item"
                    data-active={item.active ? '' : undefined}
                    className={cn(TAB_OUTER, 'fy:cursor-pointer')}
                    onClick={(event) => {
                      if (onNavigate && isPlainClick(event)) onNavigate(item.id, event);
                    }}
                  >
                    <TabLook
                      label={item.label}
                      icon={item.icon}
                      badge={item.badge}
                      active={item.active}
                      locale={locale}
                    />
                  </a>
                </li>
              ))}
            </ul>
          </Fragment>
        ))}
      </nav>
    </div>
  );
}
