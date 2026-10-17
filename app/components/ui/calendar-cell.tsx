import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type CalendarCellKind = 'day' | 'wide';

export interface CalendarCellState {
  selected?: boolean;
  /** Today (or this month / this year): outlined in the brand colour. */
  today?: boolean;
  /** A day of the previous or next month, shown to fill the grid. */
  outside?: boolean;
  /** Outside `min` / `max`: struck through, cannot be chosen (it can still take focus, so the grid stays walkable). */
  disabled?: boolean;
}

/*
 * Figma "Calendar Cell": Day 36×36, Wide 88×36 (months, years, the time columns; padding 8), `radius/md`, Label/14
 * `text/primary`. Hover = `brand/subtle` + `brand/text`; Selected = `action/primary` + `text/inverse` Label/14 Strong;
 * Today = a 1px `brand/border` outline + `brand/text` Label/14 Strong; Outside = `text/tertiary`; Disabled = `text/disabled`.
 */
export function calendarCellClass(kind: CalendarCellKind, { selected, today, outside, disabled }: CalendarCellState): string {
  return cn(
    'fy:box-border fy:inline-flex fy:h-9 fy:shrink-0 fy:select-none fy:items-center fy:justify-center fy:rounded-md fy:text-label-14 fy:text-text-primary fy:motion-base fy:focus-ring',
    kind === 'day' ? 'fy:w-9' : 'fy:min-w-0 fy:px-2',
    outside && 'fy:text-text-tertiary',
    today && !selected && 'fy:border fy:border-brand-border fy:text-label-14-strong fy:text-brand-text',
    selected && 'fy:bg-action-primary fy:text-label-14-strong fy:text-text-inverse',
    disabled ? 'fy:cursor-not-allowed fy:text-text-disabled fy:line-through' : 'fy:cursor-pointer',
    !selected && !disabled && 'fy:hover:bg-brand-subtle fy:hover:text-brand-text',
  );
}

export interface CalendarCellProps extends CalendarCellState, Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  kind?: CalendarCellKind;
  children: ReactNode;
}

/**
 * One cell of the Calendar Panel's grids (days, months, years) and of the Time Panel's columns. The caller gives it its
 * role (`gridcell`, `option`), its roving `tabIndex` and its ARIA state; the cell only draws.
 */
export const CalendarCell = forwardRef<HTMLDivElement, CalendarCellProps>(function CalendarCell(
  { kind = 'day', selected, today, outside, disabled, className, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      {...props}
      data-slot="fy-calendar-cell"
      data-selected={selected ? '' : undefined}
      data-today={today ? '' : undefined}
      data-outside={outside ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      className={cn(calendarCellClass(kind, { selected, today, outside, disabled }), className)}
    >
      {children}
    </div>
  );
});
