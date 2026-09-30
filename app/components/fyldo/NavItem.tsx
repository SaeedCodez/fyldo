import type { MouseEvent, ReactElement } from 'react';
import { __, localizeDigits } from '../../i18n';
import { Icon } from '../../icons/Icon';
import { cn } from '../../lib/cn';
import { Badge } from '../ui/badge';

export interface NavItemProps {
  label: string;
  /** Real URL: works for middle-click, "open in new tab", copy link, and without the client router. */
  href: string;
  /** Iconsax name (16px), or none. */
  icon?: string;
  /** The current page: `aria-current="page"`, Figma State=Active. */
  active?: boolean;
  /** Figma `Badge`: only for items that need attention (a count). */
  badge?: string;
  /** Figma State=Disabled: not a link, not focusable. */
  disabled?: boolean;
  /** Opens in a new tab (utility links such as Documentation). */
  external?: boolean;
  /** Page language, for the badge's numerals. */
  locale?: string;
  /** Client-side navigation; called only for a plain left click (the browser handles the rest through `href`). */
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

/** A plain left click without modifier keys: the only click the client router takes over. */
export const isPlainClick = (event: MouseEvent): boolean =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey &&
  !event.defaultPrevented;

/*
 * Figma Nav Item: padding 6/8 (32px tall in EN, 34 in FA: the height follows the line height), gap 8, radius md, 16px icon + Label/14.
 *   Default  label text/secondary, icon icon/secondary
 *   Hover    fill surface/hover, label text/primary, icon icon/primary
 *   Active   fill surface/active, Label/14 Strong text/primary, icon icon/primary
 *   Focus    fill background/default + the neutral ring (O5; Figma draws the fill only)
 *   Disabled label text/disabled, icon icon/tertiary
 */
export function NavItem({
  label,
  href,
  icon,
  active = false,
  badge,
  disabled = false,
  external = false,
  locale = 'en',
  onNavigate,
}: NavItemProps): ReactElement {
  const content = (
    <>
      {icon ? (
        <Icon
          name={icon}
          size={16}
          className={cn(
            disabled
              ? 'fy:text-icon-tertiary'
              : active
                ? 'fy:text-icon-primary'
                : 'fy:text-icon-secondary fy:group-hover/nav:text-icon-primary fy:group-focus-visible/nav:text-icon-primary',
          )}
        />
      ) : null}
      <span
        className={cn(
          'fy:min-w-0 fy:flex-1 fy:truncate',
          active ? 'fy:text-label-14-strong' : 'fy:text-label-14',
        )}
      >
        {label}
      </span>
      {badge ? <Badge>{localizeDigits(badge, locale)}</Badge> : null}
      {external ? (
        <>
          {' '}
          <span className="fy:sr-only">{__('(opens in a new tab)', 'fyldo')}</span>
        </>
      ) : null}
    </>
  );

  const look = cn(
    'fy:group/nav fy:flex fy:w-full fy:items-center fy:gap-2 fy:rounded-md fy:px-2 fy:py-1.5 fy:no-underline',
    'fy:transition-colors fy:duration-100 fy:ease-out',
    disabled
      ? 'fy:cursor-not-allowed fy:text-text-disabled'
      : active
        ? 'fy:bg-surface-active fy:text-text-primary fy:focus-ring'
        : 'fy:text-text-secondary fy:hover:bg-surface-hover fy:hover:text-text-primary fy:focus-visible:bg-background-default fy:focus-visible:text-text-primary fy:focus-ring',
  );

  if (disabled) {
    // Not a link at all (no href, not focusable): the text is still read in place, the item cannot be followed.
    return (
      <span data-slot="fy-nav-item" data-disabled="" className={look}>
        {content}
      </span>
    );
  }

  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      data-slot="fy-nav-item"
      data-active={active ? '' : undefined}
      className={look}
      onClick={(event) => {
        if (onNavigate && !external && isPlainClick(event)) onNavigate(event);
      }}
    >
      {content}
    </a>
  );
}
