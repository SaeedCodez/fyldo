import type { ReactElement } from 'react';
import { Icon } from '../../icons/Icon';
import { __, sprintf } from '../../i18n';
import { cn } from '../../lib/cn';

export type TagSize = 'sm' | 'md';

export interface TagProps {
  /** Text shown in the tag (already translated). */
  label: string;
  /** Figma `Size`: Small 20px / Medium 24px. */
  size?: TagSize;
  /** Adds the 12px remove button. Absent = a non-removable tag (the overflow "+n"). */
  onRemove?: () => void;
  /** Screen-reader text when `label` is only a glyph ("+2" → "2 more selected"). */
  srLabel?: string;
  disabled?: boolean;
  className?: string;
}

/*
 * Figma Tag: `surface/default` fill, 1px `border/default` INSIDE, radius xs; padding 6/4 (start/end) at Small and 8/6
 * at Medium with a 4px gap, Label/12 or Label/13. Figma counts the stroke in the layout, exactly like CSS border-box with
 * a real border, so Small is 20px tall and "Posts" is 59px wide. Hover fills `surface/hover` and darkens the remove icon.
 */
const SIZE: Record<TagSize, string> = {
  sm: 'fy:h-5 fy:ps-1.5 fy:pe-1 fy:text-label-12',
  md: 'fy:h-6 fy:ps-2 fy:pe-1.5 fy:text-label-13',
};

/** Tag / chip: a picked value in a Multi Select, or standalone in a filter row. */
export function Tag({ label, size = 'sm', onRemove, srLabel, disabled, className }: TagProps): ReactElement {
  return (
    <span
      data-slot="fy-tag"
      data-size={size}
      data-disabled={disabled ? '' : undefined}
      className={cn(
        'fy:group/tag fy:inline-flex fy:max-w-full fy:shrink-0 fy:items-center fy:gap-1 fy:rounded-xs fy:border fy:border-border-default fy:bg-surface-default fy:text-text-primary fy:select-none',
        'fy:transition-colors fy:duration-100 fy:ease-out fy:hover:bg-surface-hover',
        'fy:data-disabled:cursor-not-allowed fy:data-disabled:bg-surface-disabled fy:data-disabled:text-text-disabled fy:data-disabled:hover:bg-surface-disabled',
        SIZE[size],
        className,
      )}
    >
      {srLabel ? (
        <>
          <span aria-hidden="true" className="fy:min-w-0 fy:truncate">
            {label}
          </span>
          <span className="fy:sr-only">{srLabel}</span>
        </>
      ) : (
        <span className="fy:min-w-0 fy:truncate">{label}</span>
      )}
      {onRemove ? (
        // eslint-disable-next-line fyldo/icon-button-tooltip -- part of the Tag, not a Figma Icon Button: a pointer-only 12px target (Backspace on the field is the keyboard way) whose "Remove Posts" name a tooltip would only repeat next to the tag's own text
        <button
          type="button"
          // Reachable by pointer and by Backspace on the field; a button per tag would make the field a long tab sequence.
          tabIndex={-1}
          disabled={disabled}
          aria-label={sprintf(__('Remove %s', 'fyldo'), label)}
          data-slot="fy-tag-remove"
          className={cn(
            'fy:flex fy:size-3 fy:shrink-0 fy:cursor-pointer fy:items-center fy:justify-center fy:rounded-full fy:border-0 fy:bg-transparent fy:p-0',
            'fy:text-icon-tertiary fy:group-hover/tag:text-icon-primary fy:disabled:cursor-not-allowed fy:disabled:text-text-disabled fy:group-hover/tag:disabled:text-text-disabled',
            'fy:focus-ring',
          )}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <Icon name="close-circle" size={12} />
        </button>
      ) : null}
    </span>
  );
}
