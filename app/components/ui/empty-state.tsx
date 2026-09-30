// from shadcn base-nova empty @2026-09-30, restyled for Fyldo (layout only; Figma "Empty State")
import { cloneElement, createElement, type ReactElement } from 'react';
import { Icon } from '../../icons/Icon';
import { cn } from '../../lib/cn';
import type { ButtonLinkProps, ButtonProps } from './button';

export type EmptyStateSize = 'lg' | 'sm';

export interface EmptyStateProps {
  /** Figma `Size`: Large for a whole card, tab or page (480); Small inside tables, lists and narrow panels (360). */
  size?: EmptyStateSize;
  /** Iconsax name, drawn 24px (Large) or 20px (Small) in the icon box. */
  icon: string;
  /** Names what is missing ("No integrations yet"), never a vague "Nothing here". */
  title: string;
  /** One sentence: why it is empty, or what filling it gains. */
  description?: string;
  /** At most one, and it creates the first item. A Button or ButtonLink; it is drawn Primary Small. */
  primaryAction?: ReactElement<ButtonProps | ButtonLinkProps>;
  /** Usually a docs link — or "Clear search" when a filter found nothing. Drawn Secondary Small. */
  secondaryAction?: ReactElement<ButtonProps | ButtonLinkProps>;
  /** The title's heading level: 3 inside a Section Card (whose title is an h2), 2 on its own. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

/** Figma sizes: padding 48/32 · gap 20 · box 48 r-lg · icon 24 · text gap 8 (Large); 32/24 · 16 · 40 r-md · 20 · 4 (Small). */
const LOOK = {
  lg: { root: 'fy:gap-5 fy:px-8 fy:py-12', box: 'fy:size-12 fy:rounded-lg', icon: 24, text: 'fy:max-w-104 fy:gap-2', title: 'fy:text-heading-20', description: 'fy:text-copy-14' },
  sm: { root: 'fy:gap-4 fy:px-6 fy:py-8', box: 'fy:size-10 fy:rounded-md', icon: 20, text: 'fy:max-w-78 fy:gap-1', title: 'fy:text-heading-16', description: 'fy:text-copy-13' },
} as const;

/**
 * Figma "Empty State": a centred column — icon box (`background/default`, 1px `border/default`, `Shadow/Small`), title,
 * description, and up to two actions in a row (Primary then Secondary; the row mirrors in RTL). Loading is not empty:
 * show a spinner or skeleton until the data has arrived.
 */
export function EmptyState({ size = 'lg', icon, title, description, primaryAction, secondaryAction, headingLevel = 3, className }: EmptyStateProps): ReactElement {
  const look = LOOK[size];

  return (
    <div data-slot="fy-empty-state" data-size={size} className={cn('fy:flex fy:w-full fy:flex-col fy:items-center fy:text-center', look.root, className)}>
      <div
        data-slot="fy-empty-state-icon"
        className={cn('fy:flex fy:shrink-0 fy:items-center fy:justify-center fy:border fy:border-border-default fy:bg-background-default fy:text-icon-secondary fy:shadow-small', look.box)}
      >
        <Icon name={icon} size={look.icon} />
      </div>
      <div className={cn('fy:flex fy:w-full fy:flex-col fy:items-center', look.text)}>
        {createElement(`h${headingLevel}`, { className: cn(look.title, 'fy:text-text-primary') }, title)}
        {description ? <p className={cn(look.description, 'fy:text-text-secondary')}>{description}</p> : null}
      </div>
      {primaryAction || secondaryAction ? (
        <div data-slot="fy-empty-state-actions" className="fy:flex fy:flex-wrap fy:items-center fy:justify-center fy:gap-2">
          {primaryAction ? cloneElement(primaryAction, { variant: 'primary', size: 'sm' }) : null}
          {secondaryAction ? cloneElement(secondaryAction, { variant: 'secondary', size: 'sm' }) : null}
        </div>
      ) : null}
    </div>
  );
}
