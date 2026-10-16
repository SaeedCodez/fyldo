import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { __ } from '../../i18n';
import { cn } from '../../lib/cn';
import { numerals, type Time } from '../../lib/datetime';
import { Button } from './button';
import { CalendarCell } from './calendar-cell';

/** A row of a column: a 36px cell + the 4px gap. The selected value sits on the fourth row, as in Figma. */
const ROW = 40;
const ROWS_ABOVE = 3;

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** The minutes a step allows within an hour (the step divides 60: 1, 5, 15…). */
export const minutesFor = (step: number): number[] => Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step).filter((m) => m < 60);

interface ColumnProps {
  label: string;
  values: number[];
  selected: number | null;
  /** Focused (and scrolled to) when nothing is selected. */
  fallback: number;
  locale: string;
  onSelect: (value: number) => void;
}

/**
 * One column of the Time Panel: a listbox of 64-wide cells, six rows tall, that scrolls. Arrows move the selection
 * (it follows focus), Home / End jump to the ends, Page Up / Down move by six.
 */
function Column({ label, values, selected, fallback, locale, onSelect }: ColumnProps): ReactElement {
  const list = useRef<HTMLDivElement | null>(null);
  const items = useRef<Array<HTMLDivElement | null>>([]);
  const index = Math.max(0, values.indexOf(selected ?? fallback));
  const [scrolled, setScrolled] = useState<number | null>(null);

  // A value set from outside (or the first paint) brings its row to the fourth line; our own clicks keep the scroll.
  useLayoutEffect(() => {
    if (scrolled === index || !list.current) return;
    list.current.scrollTop = Math.max(0, index * ROW - ROWS_ABOVE * ROW);
    setScrolled(index);
  }, [index, scrolled]);

  const move = (to: number): void => {
    const next = Math.min(values.length - 1, Math.max(0, to));
    const value = values[next];
    if (value === undefined) return;
    setScrolled(next);
    onSelect(value);
    const item = items.current[next];
    item?.focus();
    item?.scrollIntoView?.({ block: 'nearest' });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const moves: Record<string, number> = { ArrowUp: index - 1, ArrowDown: index + 1, Home: 0, End: values.length - 1, PageUp: index - 6, PageDown: index + 6 };
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(values[index] as number);
      return;
    }
    const to = moves[event.key];
    if (to === undefined) return;
    event.preventDefault();
    move(to);
  };

  return (
    <div
      ref={list}
      role="listbox"
      aria-label={label}
      data-slot="fy-time-column"
      className="fy:flex fy:h-59 fy:w-16 fy:flex-col fy:gap-1 fy:overflow-y-auto fy:scrollbar-none"
    >
      {values.map((value, i) => (
        <CalendarCell
          key={value}
          ref={(node) => {
            items.current[i] = node;
          }}
          kind="wide"
          role="option"
          aria-selected={value === selected}
          tabIndex={i === index ? 0 : -1}
          selected={value === selected}
          onClick={() => {
            setScrolled(i);
            onSelect(value);
          }}
          onKeyDown={onKeyDown}
          className="fy:w-16"
        >
          {numerals(String(value).padStart(2, '0'), locale)}
        </CalendarCell>
      ))}
    </div>
  );
}

export interface TimePanelProps {
  /** The chosen time, or null. */
  value: Time | null;
  onValueChange: (time: Time) => void;
  /** Minutes between the offered minutes (it divides 60). */
  step?: number;
  /** What the columns show as current while nothing is chosen (the site's time). */
  fallback?: Time;
  locale?: string;
  /** `popup`: its own card with the "Now" footer (the time field). `embedded`: the columns only (beside a calendar). */
  type?: 'popup' | 'embedded';
  /** The footer's "Now": the site's current time (popup only). */
  onNow?: () => void;
  className?: string;
}

/**
 * Figma "Time Panel": an Hour and a Minute column (listboxes) with a colon between them; as a popup it is a card with a
 * "Now" button. The columns stay hour → minute, left to right, in every language (like the value 14:30).
 */
export function TimePanel({ value, onValueChange, step = 1, fallback = { hour: 0, minute: 0 }, locale = 'en', type = 'popup', onNow, className }: TimePanelProps): ReactElement {
  const minutes = minutesFor(step);
  const current = value ?? fallback;
  const nearestMinute = minutes.reduce((best, m) => (Math.abs(m - current.minute) < Math.abs(best - current.minute) ? m : best), 0);

  return (
    <div
      data-slot="fy-time-panel"
      data-type={type}
      className={cn(
        'fy:box-border fy:flex fy:w-fit fy:flex-col fy:gap-2 fy:text-text-primary',
        type === 'popup' && 'fy:rounded-lg fy:border fy:border-border-default fy:bg-background-default fy:p-3 fy:shadow-medium',
        className,
      )}
    >
      <div dir="ltr" aria-hidden="true" className="fy:flex fy:gap-1 fy:text-center fy:text-label-12 fy:text-text-tertiary">
        <span className="fy:w-16">{__('Hour', 'fyldo')}</span>
        <span className="fy:w-2" />
        <span className="fy:w-16">{__('Minute', 'fyldo')}</span>
      </div>
      <div dir="ltr" className="fy:flex fy:items-center fy:gap-1">
        <Column
          label={__('Hour', 'fyldo')}
          values={HOURS}
          selected={value ? value.hour : null}
          fallback={current.hour}
          locale={locale}
          onSelect={(hour) => onValueChange({ hour, minute: value ? value.minute : nearestMinute })}
        />
        <span aria-hidden="true" className="fy:w-2 fy:text-center fy:text-label-14-strong fy:text-text-tertiary">
          :
        </span>
        <Column
          label={__('Minute', 'fyldo')}
          values={minutes}
          selected={value && minutes.includes(value.minute) ? value.minute : null}
          fallback={nearestMinute}
          locale={locale}
          onSelect={(minute) => onValueChange({ hour: current.hour, minute })}
        />
      </div>
      {type === 'popup' && onNow ? (
        <div className="fy:flex fy:border-t fy:border-border-subtle fy:pt-2">
          <Button variant="tertiary" size="sm" onClick={onNow}>
            {__('Now', 'fyldo')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
