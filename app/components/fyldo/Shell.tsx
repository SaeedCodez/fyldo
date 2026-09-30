import { useId, useRef, useState, type MouseEvent, type ReactElement, type ReactNode, type RefObject } from 'react';
import { __ } from '../../i18n';
import { WP_MOBILE, useMediaQuery } from '../../lib/media';
import { routeHref, type Route } from '../../lib/router';
import type { FyldoConfig } from '../../types';
import { Button } from '../ui/button';
import { BrandMark } from './BrandMark';
import type { Brand, NavGroup, UtilityLink } from './nav-model';
import { Sidebar } from './Sidebar';
import { TopNavigation } from './TopNavigation';

/** Pages outside any declared group come first, without a label; empty groups are dropped. */
export function navGroups(config: FyldoConfig, route: Route): NavGroup[] {
  const known = new Set(config.groups.map((g) => g.id));
  const entry = (page: FyldoConfig['pages'][number]) => ({
    id: page.id,
    label: page.title,
    href: routeHref(config.pages, { page: page.id, tab: '' }),
    icon: page.icon || undefined,
    badge: page.badge || undefined,
    active: page.id === route.page,
  });
  const loose = config.pages.filter((p) => !known.has(p.group)).map(entry);
  const groups: NavGroup[] = loose.length > 0 ? [{ id: '', items: loose }] : [];
  for (const group of config.groups) {
    const items = config.pages.filter((p) => p.group === group.id).map(entry);
    if (items.length > 0) groups.push({ id: group.id, label: group.label, items });
  }
  return groups;
}

export const utilityLinks = (config: FyldoConfig, placement: 'footer' | 'header'): UtilityLink[] =>
  config.links
    .filter((l) => l.placement === placement)
    .map((l) => ({ label: l.label, href: l.url, icon: l.icon || undefined, external: l.external }));

/**
 * The first stop of the Tab order: skips the brand and the navigation and lands on the page's heading (WCAG 2.4.1).
 * Hidden until it has keyboard focus, then drawn at the start of the shell with the neutral focus ring. It is a link
 * pointing at the current route, whose click is handled here, so the URL is left alone.
 */
function SkipLink({ shell, href }: { shell: RefObject<HTMLDivElement | null>; href: string }): ReactElement {
  return (
    <a
      href={href}
      data-slot="fy-skip-link"
      className="fy:sr-only fy:focus:not-sr-only fy:focus:absolute fy:focus:start-4 fy:focus:top-4 fy:focus:z-50 fy:focus:rounded-sm fy:focus:border fy:focus:border-border-default fy:focus:bg-background-default fy:focus:px-4 fy:focus:py-2 fy:focus:text-label-14 fy:focus:text-text-primary fy:focus-ring"
      onClick={(event) => {
        event.preventDefault();
        shell.current?.querySelector<HTMLElement>('h1')?.focus();
      }}
    >
      {__('Skip to page content', 'fyldo')}
    </a>
  );
}

export interface ShellProps {
  config: FyldoConfig;
  route: Route;
  /** Show another page (a nav item was clicked). */
  onNavigate: (page: string) => void;
  children: ReactNode;
}

/*
 * The two Settings page templates of the pack:
 *   sidebar  the 256px Sidebar, full height and sticky below the admin bar, beside the content area
 *   top      the Top Navigation across the full width above the content area
 * The content column (800px, centred) is the page's own. At ≤782px (wp-admin's mobile breakpoint; the design is
 * silent, docs/ARCHITECTURE.md §8.3) the Sidebar becomes a "Menu" disclosure above the content.
 */
export function Shell({ config, route, onNavigate, children }: ShellProps): ReactElement {
  const mobile = useMediaQuery(WP_MOBILE);
  const shell = useRef<HTMLDivElement>(null);
  const brand: Brand = { name: config.title, logo: config.logo ?? undefined, version: config.version || undefined };
  const groups = navGroups(config, route);
  const go = (page: string, event: MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    onNavigate(page);
  };

  if (config.navigation === 'top') {
    return (
      <div
        ref={shell}
        data-slot="fy-shell"
        data-layout="top"
        className="fy:relative fy:flex fy:flex-col fy:bg-background-default"
      >
        <SkipLink shell={shell} href={routeHref(config.pages, route)} />
        {/* Utility links live top-right here, and the Page Header shows no actions (design rule 16). */}
        <TopNavigation
          brand={brand}
          groups={groups}
          links={[...utilityLinks(config, 'footer'), ...utilityLinks(config, 'header')].filter(
            (l, i, all) => all.findIndex((o) => o.href === l.href) === i,
          )}
          locale={config.locale}
          onNavigate={go}
        />
        <div className="fy:flex fy:min-w-0 fy:flex-1 fy:flex-col">{children}</div>
      </div>
    );
  }

  return (
    <div ref={shell} data-slot="fy-shell" data-layout="sidebar" className="fy:relative fy:flex fy:bg-background-default">
      <SkipLink shell={shell} href={routeHref(config.pages, route)} />
      {mobile ? null : (
        <div data-slot="fy-sidebar-column" className="fy:shrink-0 fy:bg-background-subtle">
          <div data-slot="fy-sidebar-sticky">
            <Sidebar
              brand={brand}
              groups={groups}
              links={utilityLinks(config, 'footer')}
              locale={config.locale}
              onNavigate={go}
            />
          </div>
        </div>
      )}
      <div className="fy:flex fy:min-w-0 fy:flex-1 fy:flex-col">
        {mobile ? (
          <MenuDisclosure
            brand={brand}
            groups={groups}
            links={utilityLinks(config, 'footer')}
            locale={config.locale}
            route={route}
            onNavigate={go}
          />
        ) : null}
        {children}
      </div>
    </div>
  );
}

interface MenuDisclosureProps {
  brand: Brand;
  groups: NavGroup[];
  links: UtilityLink[];
  locale: string;
  route: Route;
  onNavigate: (page: string, event: MouseEvent<HTMLAnchorElement>) => void;
}

/** ≤782px: the brand and a "Menu" button (a disclosure, `aria-expanded`) that shows the Sidebar's navigation below it. */
function MenuDisclosure({
  brand,
  groups,
  links,
  locale,
  route,
  onNavigate,
}: MenuDisclosureProps): ReactElement {
  // Open for the page it was opened on: picking a page (or Back/Forward) closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === route.page;
  const panelId = useId();

  return (
    <div data-slot="fy-menu-disclosure" className="fy:bg-background-subtle">
      <div className="fy:flex fy:items-center fy:gap-4 fy:border-b fy:border-border-default fy:px-4 fy:py-3">
        <BrandMark brand={brand} locale={locale} />
        <span className="fy:flex-1" />
        <Button
          variant="secondary"
          size="sm"
          aria-expanded={open}
          aria-controls={panelId}
          trailingIcon={open ? 'arrow-up-2' : 'arrow-down-2'}
          onClick={() => setOpenOn(open ? null : route.page)}
        >
          {__('Menu', 'fyldo')}
        </Button>
      </div>
      <div id={panelId} hidden={!open}>
        {open ? (
          <Sidebar
            variant="drawer"
            brand={brand}
            groups={groups}
            links={links}
            locale={locale}
            onNavigate={onNavigate}
          />
        ) : null}
      </div>
    </div>
  );
}
