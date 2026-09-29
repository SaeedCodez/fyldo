import type { ReactElement } from 'react';
import { localizeDigits } from '../../i18n';
import { Icon } from '../../icons/Icon';
import { cn } from '../../lib/cn';
import { Badge } from '../ui/badge';

export interface TabLookProps {
  label: string;
  /** Iconsax name (16px): the Top Navigation draws one per section; sub-page tabs usually have none. */
  icon?: string;
  /** Figma `Count` badge. */
  badge?: string;
  active: boolean;
  disabled?: boolean;
  locale?: string;
}

/*
 * Figma Tab: a 48px column (50 in FA) — 8px top padding, the Content box (32px; 34 in FA) (padding 6/12, gap 6, radius md, Label/14), a 6px
 * gap and the 2px Indicator (action/primary when Active). Hover fills the Content box with surface/hover.
 * Label/icon: text/secondary + icon/secondary → text/primary + icon/primary on Hover, Focus and Active; Disabled
 * text/disabled + icon/tertiary. Focus: the neutral ring around the Content box (O5; Figma draws a fill only).
 *
 * The outer element is the interactive one (a Base UI Tab button for sub-pages, a link in the Top Navigation), with
 * these classes; <TabLook> is what goes inside it.
 */
export const TAB_OUTER =
  'fy:group/tab fy:relative fy:flex fy:shrink-0 fy:flex-col fy:gap-1.5 fy:pt-2 fy:no-underline fy:outline-none fy:select-none';

export function TabLook({
  label,
  icon,
  badge,
  active,
  disabled = false,
  locale = 'en',
}: TabLookProps): ReactElement {
  return (
    <>
      <span
        data-slot="fy-tab-content"
        className={cn(
          'fy:focus-ring-inner fy:flex fy:items-center fy:gap-1.5 fy:rounded-md fy:px-3 fy:py-1.5 fy:text-label-14 fy:whitespace-nowrap',
          'fy:transition-colors fy:duration-100 fy:ease-out',
          disabled
            ? 'fy:text-text-disabled'
            : active
              ? 'fy:text-text-primary fy:group-hover/tab:bg-surface-hover'
              : 'fy:text-text-secondary fy:group-hover/tab:bg-surface-hover fy:group-hover/tab:text-text-primary fy:group-focus-visible/tab:text-text-primary',
        )}
      >
        {icon ? (
          <Icon
            name={icon}
            size={16}
            className={cn(
              disabled
                ? 'fy:text-icon-tertiary'
                : active
                  ? 'fy:text-icon-primary'
                  : 'fy:text-icon-secondary fy:group-hover/tab:text-icon-primary fy:group-focus-visible/tab:text-icon-primary',
            )}
          />
        ) : null}
        <span>{label}</span>
        {badge ? <Badge>{localizeDigits(badge, locale)}</Badge> : null}
      </span>
      <span
        data-slot="fy-tab-indicator"
        aria-hidden="true"
        className={cn('fy:h-0.5 fy:w-full', active && 'fy:bg-action-primary')}
      />
    </>
  );
}
