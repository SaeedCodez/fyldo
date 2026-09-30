import { useId, type MouseEvent, type ReactElement } from 'react';
import { __ } from '../../i18n';
import { cn } from '../../lib/cn';
import { BrandMark } from './BrandMark';
import type { Brand, NavGroup, UtilityLink } from './nav-model';
import { NavItem } from './NavItem';

export interface SidebarProps {
  brand: Brand;
  groups: NavGroup[];
  /** Utility links at the bottom (Documentation, Help & support). */
  links?: UtilityLink[];
  locale?: string;
  /** Client-side navigation to a page (plain left click on a nav item). */
  onNavigate?: (pageId: string, event: MouseEvent<HTMLAnchorElement>) => void;
  /**
   * `column`: the full-height 256px column beside the content (Figma). `drawer`: the same navigation, full width, in the
   * ≤782px "Menu" disclosure — no brand (the disclosure row shows it) and no end border.
   */
  variant?: 'column' | 'drawer';
  id?: string;
}

/*
 * Figma Sidebar (256 wide, background/subtle, 1px end border):
 *   Header      padding 20/20/16/20, gap 10: brand (60 high)
 *   Navigation  padding 8/16/0/16, groups 20 apart; a group = Group label (Label/12 text/tertiary, padding 0/8/6/8) +
 *               Nav Items 2 apart
 *   Footer      padding 12/16, gap 2, 1px top border: utility Nav Items
 */
export function Sidebar({
  brand,
  groups,
  links = [],
  locale = 'en',
  onNavigate,
  variant = 'column',
  id,
}: SidebarProps): ReactElement {
  const base = useId();
  const drawer = variant === 'drawer';

  return (
    <div
      id={id}
      data-slot="fy-sidebar"
      data-variant={variant}
      className={cn(
        'fy:flex fy:flex-col fy:bg-background-subtle',
        drawer
          ? 'fy:w-full fy:border-b fy:border-border-default'
          : 'fy:h-full fy:w-64 fy:border-e fy:border-border-default',
      )}
    >
      {drawer ? null : (
        <div
          data-slot="fy-sidebar-header"
          className="fy:flex fy:shrink-0 fy:items-center fy:gap-2.5 fy:px-5 fy:pt-5 fy:pb-4"
        >
          <BrandMark brand={brand} locale={locale} />
        </div>
      )}

      <nav
        aria-label={brand.name}
        data-slot="fy-sidebar-nav"
        className={cn(
          'fy:flex fy:flex-col fy:gap-5 fy:px-4 fy:pt-2',
          drawer ? 'fy:pb-3' : 'fy:min-h-0 fy:flex-1 fy:overflow-y-auto fy:pb-0',
        )}
      >
        {groups.map((group) => {
          const labelId = `${base}-${group.id}`;
          return (
            <div key={group.id} data-slot="fy-nav-group" className="fy:flex fy:flex-col fy:gap-0.5">
              {group.label ? (
                <div
                  id={labelId}
                  className="fy:px-2 fy:pb-1.5 fy:text-label-12 fy:text-text-tertiary"
                >
                  {group.label}
                </div>
              ) : null}
              <ul
                aria-labelledby={group.label ? labelId : undefined}
                className="fy:flex fy:flex-col fy:gap-0.5"
              >
                {group.items.map((item) => (
                  <li key={item.id}>
                    <NavItem
                      label={item.label}
                      href={item.href}
                      icon={item.icon}
                      badge={item.badge}
                      active={item.active}
                      locale={locale}
                      onNavigate={onNavigate ? (event) => onNavigate(item.id, event) : undefined}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      {links.length > 0 ? (
        <nav
          aria-label={__('Resources', 'fyldo')}
          data-slot="fy-sidebar-footer"
          className="fy:shrink-0 fy:border-t fy:border-border-default fy:px-4 fy:py-3"
        >
          <ul className="fy:flex fy:flex-col fy:gap-0.5">
            {links.map((link) => (
              <li key={link.href}>
                <NavItem
                  label={link.label}
                  href={link.href}
                  icon={link.icon}
                  external={link.external}
                  locale={locale}
                />
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
