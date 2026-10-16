import { useDirection } from '@base-ui/react/direction-provider';
import { Field } from '@base-ui/react/field';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { __ } from '../../i18n';
import { cn } from '../../lib/cn';
import {
  formatDate,
  formatDateTime,
  formatDay,
  nowOnStep,
  fromJdn,
  monthName,
  numerals,
  parseDate,
  siteMomentOf,
  siteNow,
  siteToUtc,
  toJdn,
  weekday,
  weekdayLong,
  weekdayShort,
  weekStart,
  calendarName,
  type CalendarKind,
  type Time,
} from '../../lib/datetime';
import { gregorianMonthLength, gregorianToJdn, jalaliMonthLength, jdnToGregorian, type YMD } from '../../lib/jalali';
import { Button } from './button';
import { CalendarCell } from './calendar-cell';
import { IconButton } from './icon-button';
import { SegmentedControl } from './segmented-control';
import { TimePanel } from './time-panel';

type View = 'days' | 'months' | 'years';

/** The years view shows twelve years, the shown one seventh (2020–2031 around 2026, 1399–1410 around 1405). */
const YEARS = 12;
const YEARS_BEFORE = 6;

const monthLength = (calendar: CalendarKind, year: number, month: number): number =>
  calendar === 'jalali' ? jalaliMonthLength(year, month) : gregorianMonthLength(year, month);

/** The same day `n` months later (the day is kept, or the month's last day). */
function addMonths(calendar: CalendarKind, jdn: number, n: number): number {
  const { year, month, day } = fromJdn(calendar, jdn);
  const total = year * 12 + (month - 1) + n;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  return toJdn(calendar, { year: y, month: m, day: Math.min(day, monthLength(calendar, y, m)) });
}

export interface CalendarPanelProps {
  /** `date`: the value is `Y-m-d`. `datetime`: `Y-m-d H:i:s` in UTC, drawn and picked in the site's time (Time on). */
  kind?: 'date' | 'datetime';
  /** The stored value, or ''. */
  value: string;
  onValueChange: (value: string) => void;
  /** A day was chosen, or Today / Clear pressed: a date field closes its popup. */
  onPick?: () => void;
  /** The calendar shown first. */
  calendar: CalendarKind;
  /** Figma "Calendar switch": people may switch the view between Jalali and Gregorian (the value never changes). */
  switchable?: boolean;
  /** The earliest and latest value (stored format, `today` / `now` already resolved): days outside are disabled. */
  min?: string;
  max?: string;
  /** Minutes between the offered minutes (datetime). */
  step?: number;
  locale?: string;
  className?: string;
}

/**
 * Figma "Calendar Panel": the calendar switch, a header (month and year button, previous / next), the Days, Months or
 * Years view and a footer with Today and Clear; for a datetime the Time Panel sits beside the calendar. The day grid
 * follows the WAI-ARIA date picker dialog: arrows move by day, Page Up / Down by month (with Shift by year), Home / End
 * to the ends of the week, Enter or Space chooses. Weeks start on Saturday in Jalali and on the site's day in Gregorian.
 */
export function CalendarPanel({
  kind = 'date',
  value,
  onValueChange,
  onPick,
  calendar: initial,
  switchable = true,
  min,
  max,
  step = 1,
  locale = 'en',
  className,
}: CalendarPanelProps): ReactElement {
  const rtl = useDirection() === 'rtl';
  const titleId = useId();
  const root = useRef<HTMLDivElement | null>(null);
  const refocus = useRef(false);

  const local = kind === 'datetime' ? siteMomentOf(value) : null;
  const selected: YMD | null = kind === 'date' ? parseDate(value) : local;
  const selectedJdn = selected ? gregorianToJdn(selected) : null;
  const time: Time | null = local ? { hour: local.hour, minute: local.minute } : null;
  const today = siteNow();
  const todayJdn = gregorianToJdn(today);

  // The bounds as days (a datetime's in the site's time): a day is disabled when it is wholly outside them.
  const bound = (b: string | undefined): number | null => {
    if (!b) return null;
    const day = kind === 'date' ? parseDate(b) : siteMomentOf(b);
    return day ? gregorianToJdn(day) : null;
  };
  const minJdn = bound(min);
  const maxJdn = bound(max);
  const outOfRange = (from: number, to = from): boolean => (minJdn !== null && to < minJdn) || (maxJdn !== null && from > maxJdn);

  const [calendar, setCalendar] = useState<CalendarKind>(initial);
  const [view, setView] = useState<View>('days');
  const [active, setActive] = useState<number>(selectedJdn ?? todayJdn);
  const [firstYear, setFirstYear] = useState(0);
  const [seen, setSeen] = useState(value);

  // A value set from outside (Today, Clear, the field) shows its month.
  if (value !== seen) {
    setSeen(value);
    if (selectedJdn !== null) setActive(selectedJdn);
  }

  const shown = fromJdn(calendar, active);

  // After a key moved the active cell (perhaps into another month or view), focus follows it.
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    root.current?.querySelector<HTMLElement>('[data-active-cell]')?.focus();
  });

  const moveTo = (jdn: number, focus = true): void => {
    refocus.current = focus;
    setActive(jdn);
    const year = fromJdn(calendar, jdn).year;
    if (view === 'years' && (year < firstYear || year >= firstYear + YEARS)) setFirstYear(firstYear + Math.floor((year - firstYear) / YEARS) * YEARS);
  };

  const emitDay = (day: YMD, at: Time | null): void => {
    if (kind === 'date') {
      onValueChange(formatDate(day));
      return;
    }
    const t = at ?? time ?? { hour: 0, minute: 0 };
    onValueChange(formatDateTime(siteToUtc({ ...day, hour: t.hour, minute: t.minute, second: 0 })));
  };

  const pickDay = (jdn: number): void => {
    if (outOfRange(jdn)) return;
    setActive(jdn);
    emitDay(jdnToGregorian(jdn), null);
    onPick?.();
  };

  const openView = (next: View, jdn = active): void => {
    refocus.current = true;
    if (next === 'years') setFirstYear(fromJdn(calendar, jdn).year - YEARS_BEFORE);
    setActive(jdn);
    setView(next);
  };

  // ── Header ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  const title =
    view === 'days'
      ? numerals(`${monthName(calendar, shown.month)} ${shown.year}`, locale)
      : view === 'months'
        ? numerals(shown.year, locale)
        : numerals(`${firstYear} – ${firstYear + YEARS - 1}`, locale);
  const [previousLabel, nextLabel] =
    view === 'days'
      ? [__('Previous month', 'fyldo'), __('Next month', 'fyldo')]
      : view === 'months'
        ? [__('Previous year', 'fyldo'), __('Next year', 'fyldo')]
        : [__('Previous years', 'fyldo'), __('Next years', 'fyldo')];
  const page = (direction: 1 | -1): void => {
    if (view === 'years') {
      setFirstYear(firstYear + direction * YEARS);
      setActive(addMonths(calendar, active, direction * YEARS * 12));
      return;
    }
    setActive(addMonths(calendar, active, direction * (view === 'days' ? 1 : 12)));
  };

  // ── Days ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const start = weekStart(calendar);
  const first = toJdn(calendar, { year: shown.year, month: shown.month, day: 1 });
  const gridStart = first - ((weekday(first) - start + 7) % 7);
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => gridStart + w * 7 + d));

  const onDayKey = (event: KeyboardEvent<HTMLElement>): void => {
    const weekFirst = active - ((weekday(active) - start + 7) % 7);
    const forward = rtl ? -1 : 1;
    const moves: Record<string, number> = {
      ArrowRight: active + forward,
      ArrowLeft: active - forward,
      ArrowDown: active + 7,
      ArrowUp: active - 7,
      Home: weekFirst,
      End: weekFirst + 6,
      PageDown: addMonths(calendar, active, event.shiftKey ? 12 : 1),
      PageUp: addMonths(calendar, active, event.shiftKey ? -12 : -1),
    };
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pickDay(active);
      return;
    }
    const to = moves[event.key];
    if (to === undefined) return;
    event.preventDefault();
    moveTo(to);
  };

  // ── Months and years: a 3-column grid of Wide cells ───────────────────────────────────────────────────────────────
  const onListKey = (event: KeyboardEvent<HTMLElement>, choose: () => void, by: (n: number) => number): void => {
    const forward = rtl ? -1 : 1;
    const moves: Record<string, number> = { ArrowRight: forward, ArrowLeft: -forward, ArrowDown: 3, ArrowUp: -3 };
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose();
      return;
    }
    const n = moves[event.key];
    if (n === undefined) return;
    event.preventDefault();
    moveTo(by(n));
  };

  const selectedIn = selectedJdn !== null ? fromJdn(calendar, selectedJdn) : null;
  const todayIn = fromJdn(calendar, todayJdn);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: YEARS }, (_, i) => firstYear + i);
  const rows = <T,>(list: T[]): T[][] => [list.slice(0, 3), list.slice(3, 6), list.slice(6, 9), list.slice(9, 12)];

  const monthRange = (year: number, month: number): [number, number] => {
    const from = toJdn(calendar, { year, month, day: 1 });
    return [from, from + monthLength(calendar, year, month) - 1];
  };
  const yearRange = (year: number): [number, number] => [toJdn(calendar, { year, month: 1, day: 1 }), toJdn(calendar, { year: year + 1, month: 1, day: 1 }) - 1];

  // ── Footer ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  const goToday = (): void => {
    setView('days');
    setActive(todayJdn);
    emitDay(today, time ?? (kind === 'datetime' ? nowOnStep(step) : null));
    onPick?.();
  };

  const switchOrder: CalendarKind[] = locale.toLowerCase().startsWith('fa') ? ['jalali', 'gregorian'] : ['gregorian', 'jalali'];

  return (
    <div
      ref={root}
      data-slot="fy-calendar-panel"
      data-view={view}
      className={cn(
        'fy:box-border fy:flex fy:w-fit fy:flex-col fy:gap-3 fy:rounded-lg fy:border fy:border-border-default fy:bg-background-default fy:p-3 fy:text-text-primary fy:shadow-medium',
        className,
      )}
    >
      {switchable ? (
        // Its own Field: the popup is portalled but still inside the date field's Field, whose label would otherwise name
        // (and whose value this view-only switch would join) the radio group.
        <Field.Root>
          <SegmentedControl
            fill
            aria-label={__('Calendar', 'fyldo')}
            options={switchOrder.map((c) => ({ value: c, label: calendarName(c) }))}
            value={calendar}
            onValueChange={(next) => setCalendar(next as CalendarKind)}
          />
        </Field.Root>
      ) : null}

      <div className="fy:flex fy:gap-3">
        <div className="fy:flex fy:w-69 fy:flex-col fy:gap-2">
          <div className="fy:flex fy:items-center fy:justify-between">
            <Button
              variant="tertiary"
              size="sm"
              trailingIcon="arrow-down-2"
              aria-live="polite"
              id={titleId}
              data-slot="fy-calendar-title"
              onClick={() => openView(view === 'days' ? 'months' : view === 'months' ? 'years' : 'days')}
            >
              {title}
            </Button>
            <div className="fy:flex fy:gap-1">
              <IconButton icon="arrow-left-2" label={previousLabel} onClick={() => page(-1)} />
              <IconButton icon="arrow-right-2" label={nextLabel} onClick={() => page(1)} />
            </div>
          </div>

          {view === 'days' ? (
            <div role="grid" aria-labelledby={titleId} data-slot="fy-calendar-grid" className="fy:flex fy:flex-col fy:gap-2">
              <div role="row" className="fy:flex fy:gap-1">
                {Array.from({ length: 7 }, (_, i) => (start + i) % 7).map((day) => (
                  <div key={day} role="columnheader" aria-label={weekdayLong(day)} className="fy:w-9 fy:text-center fy:text-label-12 fy:text-text-tertiary">
                    <span aria-hidden="true">{weekdayShort(day)}</span>
                  </div>
                ))}
              </div>
              <div role="rowgroup" className="fy:flex fy:flex-col fy:gap-1">
                {weeks.map((week) => (
                  <div key={week[0]} role="row" className="fy:flex fy:gap-1">
                    {week.map((jdn) => {
                      const day = fromJdn(calendar, jdn);
                      const disabled = outOfRange(jdn);
                      return (
                        <CalendarCell
                          key={jdn}
                          role="gridcell"
                          tabIndex={jdn === active ? 0 : -1}
                          data-active-cell={jdn === active ? '' : undefined}
                          aria-selected={jdn === selectedJdn}
                          aria-disabled={disabled || undefined}
                          aria-current={jdn === todayJdn ? 'date' : undefined}
                          aria-label={`${weekdayLong(weekday(jdn))}, ${formatDay(calendar, jdnToGregorian(jdn), locale)}`}
                          selected={jdn === selectedJdn}
                          today={jdn === todayJdn}
                          outside={day.month !== shown.month}
                          disabled={disabled}
                          onClick={() => pickDay(jdn)}
                          onFocus={() => setActive(jdn)}
                          onKeyDown={onDayKey}
                        >
                          {numerals(day.day, locale)}
                        </CalendarCell>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div role="grid" aria-labelledby={titleId} data-slot="fy-calendar-grid" className="fy:flex fy:flex-col fy:gap-1">
              {view === 'months'
                ? rows(months).map((row) => (
                    <div key={row[0]} role="row" className="fy:grid fy:grid-cols-3 fy:gap-1">
                      {row.map((month) => {
                        const [from, to] = monthRange(shown.year, month);
                        const isSelected = selectedIn !== null && selectedIn.year === shown.year && selectedIn.month === month;
                        const choose = (): void => openView('days', toJdn(calendar, { year: shown.year, month, day: Math.min(shown.day, monthLength(calendar, shown.year, month)) }));
                        return (
                          <CalendarCell
                            key={month}
                            kind="wide"
                            role="gridcell"
                            tabIndex={month === shown.month ? 0 : -1}
                            data-active-cell={month === shown.month ? '' : undefined}
                            aria-selected={isSelected}
                            aria-disabled={outOfRange(from, to) || undefined}
                            selected={isSelected}
                            today={todayIn.year === shown.year && todayIn.month === month}
                            disabled={outOfRange(from, to)}
                            onClick={choose}
                            onKeyDown={(event) => onListKey(event, choose, (n) => addMonths(calendar, active, n))}
                            className="fy:h-13"
                          >
                            {monthName(calendar, month)}
                          </CalendarCell>
                        );
                      })}
                    </div>
                  ))
                : rows(years).map((row) => (
                    <div key={row[0]} role="row" className="fy:grid fy:grid-cols-3 fy:gap-1">
                      {row.map((year) => {
                        const [from, to] = yearRange(year);
                        const isSelected = selectedIn !== null && selectedIn.year === year;
                        const choose = (): void => openView('months', addMonths(calendar, active, (year - shown.year) * 12));
                        return (
                          <CalendarCell
                            key={year}
                            kind="wide"
                            role="gridcell"
                            tabIndex={year === shown.year ? 0 : -1}
                            data-active-cell={year === shown.year ? '' : undefined}
                            aria-selected={isSelected}
                            aria-disabled={outOfRange(from, to) || undefined}
                            selected={isSelected}
                            today={todayIn.year === year}
                            disabled={outOfRange(from, to)}
                            onClick={choose}
                            onKeyDown={(event) => onListKey(event, choose, (n) => addMonths(calendar, active, n * 12))}
                            className="fy:h-13"
                          >
                            {numerals(year, locale)}
                          </CalendarCell>
                        );
                      })}
                    </div>
                  ))}
            </div>
          )}
        </div>

        {kind === 'datetime' ? (
          <>
            <div aria-hidden="true" className="fy:w-px fy:shrink-0 fy:self-stretch fy:bg-border-subtle" />
            <TimePanel
              type="embedded"
              value={time}
              step={step}
              fallback={nowOnStep(step)}
              locale={locale}
              onValueChange={(next) => emitDay(selected ?? today, next)}
            />
          </>
        ) : null}
      </div>

      <div className="fy:flex fy:items-start fy:justify-between fy:border-t fy:border-border-subtle fy:pt-2">
        <Button variant="tertiary" size="sm" onClick={goToday}>
          {__('Today', 'fyldo')}
        </Button>
        <Button
          variant="tertiary"
          size="sm"
          onClick={() => {
            onValueChange('');
            onPick?.();
          }}
        >
          {__('Clear', 'fyldo')}
        </Button>
      </div>
    </div>
  );
}

