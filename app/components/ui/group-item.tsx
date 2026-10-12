import { forwardRef, useId, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { _n, sprintf } from '../../i18n';
import { Icon } from '../../icons/Icon';
import { cn } from '../../lib/cn';
import { Badge } from './badge';

export interface GroupItemProps {
  /** The item's name in its header ("Pricing", or "Item 2" when it has none). */
  title: string;
  /** One line under the title (a link): Mono/12 when `mono`. */
  summary?: string;
  mono?: boolean;
  /** Preview tile: an Iconsax name, '' for an empty (dashed) tile, `undefined` for no tile. */
  preview?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Invalid sub-fields inside: red border and a count in the header (shown while collapsed too). */
  errorCount?: number;
  /** Figma `State=Dragging`: lifted while it is being moved. */
  dragging?: boolean;
  /** The drag handle, at the start of the header (Group owns the dragging). */
  handle?: ReactNode;
  /** Duplicate / Remove Icon Buttons, before the chevron. */
  actions?: ReactNode;
  /** The sub-fields. Rendered only while open. */
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Figma "Group Item": a card (border/default, radius md) whose header is a disclosure button — preview tile, title and
 * summary; the handle and the actions sit above it so they stay their own buttons, and a click anywhere else in the
 * header (the chevron too) opens or closes the item. The body holds the sub-fields, 20 padding, 16 apart.
 */
export const GroupItem = forwardRef<HTMLDivElement, GroupItemProps>(function GroupItem(
  {
    title,
    summary,
    mono = false,
    preview,
    open,
    onOpenChange,
    errorCount = 0,
    dragging = false,
    handle,
    actions,
    children,
    className,
    style,
  },
  ref,
): ReactElement {
  const bodyId = useId();
  const invalid = errorCount > 0;

  return (
    <div
      ref={ref}
      data-slot="fy-group-item"
      data-open={open ? '' : undefined}
      data-dragging={dragging ? '' : undefined}
      data-invalid={invalid ? '' : undefined}
      style={style}
      className={cn(
        'fy:motion-base fy:overflow-hidden fy:rounded-md fy:border fy:bg-background-default',
        dragging
          ? 'fy:relative fy:z-10 fy:border-brand-border fy:shadow-medium'
          : invalid
            ? 'fy:border-status-error-solid'
            : 'fy:border-border-default',
        className,
      )}
    >
      <div
        data-slot="fy-group-item-header"
        className="fy:relative fy:flex fy:items-center fy:gap-3 fy:px-4 fy:py-3"
      >
        {handle ? <div className="fy:relative fy:z-10 fy:flex">{handle}</div> : null}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          onClick={() => onOpenChange(!open)}
          data-slot="fy-group-item-toggle"
          // The button's box covers the whole header (after:inset-0): the chevron and the empty space toggle too.
          className="fy:flex fy:min-w-0 fy:flex-1 fy:items-center fy:gap-3 fy:text-start fy:after:absolute fy:after:inset-0 fy:focus-ring-cover"
        >
          {preview !== undefined ? (
            <span
              data-slot="fy-group-item-preview"
              className={cn(
                'fy:flex fy:size-9 fy:shrink-0 fy:items-center fy:justify-center fy:rounded-sm fy:border fy:bg-background-subtle fy:text-icon-primary',
                preview ? 'fy:border-border-subtle' : 'fy:border-dashed fy:border-border-default',
              )}
            >
              {preview ? <Icon name={preview} size={18} /> : null}
            </span>
          ) : null}
          <span className="fy:flex fy:min-w-0 fy:flex-1 fy:flex-col fy:gap-0.5">
            <span
              data-slot="fy-group-item-title"
              className="fy:truncate fy:text-label-14-strong fy:text-text-primary"
            >
              {title}
            </span>
            {summary ? (
              <span
                data-slot="fy-group-item-summary"
                dir={mono ? 'ltr' : undefined}
                className={cn(
                  'fy:truncate fy:text-text-tertiary',
                  mono ? 'fy:text-mono-12 fy:rtl:text-end' : 'fy:text-copy-13',
                )}
              >
                {summary}
              </span>
            ) : null}
          </span>
        </button>
        {invalid ? (
          <Badge tone="red" size="sm" className="fy:shrink-0">
            {sprintf(_n('%d error', '%d errors', errorCount, 'fyldo'), errorCount)}
          </Badge>
        ) : null}
        {/* Figma "Actions": Duplicate, Remove and the chevron, 4 apart. Only the buttons sit above the header's toggle. */}
        <div className="fy:flex fy:shrink-0 fy:items-center fy:gap-1">
          {actions ? (
            <div className="fy:relative fy:z-10 fy:flex fy:items-center fy:gap-1">{actions}</div>
          ) : null}
          <span
            aria-hidden="true"
            className="fy:flex fy:size-9 fy:items-center fy:justify-center fy:text-icon-secondary"
          >
            <Icon name={open ? 'arrow-up-2' : 'arrow-down-2'} size={18} />
          </span>
        </div>
      </div>
      {open ? (
        <div
          id={bodyId}
          data-slot="fy-group-item-body"
          className="fy:border-t fy:border-border-subtle fy:p-5"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
});
