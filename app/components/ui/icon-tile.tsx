import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Icon } from '../../icons/Icon';
import { cn } from '../../lib/cn';

export interface IconTileProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'role' | 'aria-selected'> {
  /** Iconsax name: drawn at 24px, and the tile's accessible name. */
  icon: string;
  selected?: boolean;
  /** Draw the glyph. The picker's grid turns it on once the tile has scrolled into view (the icon module is only fetched then). */
  showIcon?: boolean;
}

/*
 * Figma "Icon Tile" (64×64, radius md, a 24px Linear icon in `icon/primary`). Default: 1px `border/default`. Hover:
 * `surface/hover` + `border/strong`. Selected: `background/subtle`, a 2px `focus/border` stroke and a 16px `control/on` check at
 * the top END corner (top-start in Persian). Focus: a 2px `focus/ring-neutral` stroke and the soft 3px halo of the inputs.
 * Disabled: 40% opacity. An option of the picker's listbox: the name is the icon's name, since the glyph alone says nothing.
 */
export const IconTile = forwardRef<HTMLButtonElement, IconTileProps>(function IconTile({ icon, selected = false, showIcon = true, className, ...props }, ref) {
  return (
    <button
      type="button"
      role="option"
      ref={ref}
      aria-selected={selected}
      aria-label={icon}
      data-slot="fy-icon-tile"
      data-icon={icon}
      data-selected={selected ? '' : undefined}
      className={cn(
        'fy:relative fy:box-border fy:flex fy:size-16 fy:shrink-0 fy:items-center fy:justify-center fy:rounded-md fy:p-0 fy:text-icon-primary fy:outline-none',
        'fy:cursor-pointer fy:transition-colors fy:duration-100 fy:ease-out',
        selected ? 'fy:border-2 fy:border-focus-border fy:bg-background-subtle' : 'fy:border fy:border-border-default fy:bg-background-default fy:hover:border-border-strong fy:hover:bg-surface-hover',
        'fy:focus-visible:border-2 fy:focus-visible:border-focus-ring-neutral fy:focus-visible:shadow-focus-input',
        'fy:disabled:cursor-not-allowed fy:disabled:opacity-40 fy:disabled:hover:border-border-default fy:disabled:hover:bg-background-default',
        className,
      )}
      {...props}
    >
      {showIcon ? <Icon name={icon} size={24} /> : <span aria-hidden="true" className="fy:size-6" />}
      {selected ? (
        <span aria-hidden="true" data-slot="fy-icon-tile-check" className="fy:absolute fy:end-1 fy:top-1 fy:flex fy:size-4 fy:items-center fy:justify-center fy:rounded-full fy:bg-control-on fy:text-text-inverse">
          <svg width="8" height="6.4" viewBox="0 0 8 6.4" fill="none" focusable="false">
            <path d="M0.75 3.3 2.9 5.45 7.25 0.95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}
    </button>
  );
});
