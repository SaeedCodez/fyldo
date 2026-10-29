import { Field } from '@base-ui/react/field';
import type { Popover } from '@base-ui/react/popover';
import { lazy, Suspense, useContext, useId, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { Icon } from '../../icons/Icon';
import { __ } from '../../i18n';
import { cn } from '../../lib/cn';
import { useScreenLocale } from '../../lib/portal';
import {
  equivalentText,
  formatTime,
  formatValue,
  initialCalendar,
  nowOnStep,
  parseTime,
  readTypedTime,
  resolveBound,
  type CalendarKind,
  type Time,
} from '../../lib/datetime';
import { CONTROL_BASE, CONTROL_SIZE, type ControlSize } from './control';
import { InFieldRoot } from './field-shell';
import { Tooltip } from './tooltip';

/** The panels (and Base UI's Popover with them) are their own chunk, fetched the first time a picker opens. */
const CalendarPopover = lazy(() => import('./date-time-popover').then((m) => ({ default: m.CalendarPopover })));
const TimePopover = lazy(() => import('./date-time-popover').then((m) => ({ default: m.TimePopover })));

/** Figma "Date Field": the icon at the start and the chevron at the end, both 16 `icon/secondary`. */
const GLYPH = 'fy:flex fy:shrink-0 fy:text-icon-secondary fy:group-data-[disabled]/field:text-text-disabled';

function Chevron({ group }: { group: 'date' | 'time' }): ReactElement {
  return (
    <span className={GLYPH}>
      <Icon name="arrow-down-2" size={16} className={group === 'date' ? 'fy:group-data-[popup-open]/date:hidden' : 'fy:group-data-[popup-open]/time:hidden'} />
      <Icon
        name="arrow-up-2"
        size={16}
        className={group === 'date' ? 'fy:hidden fy:group-data-[popup-open]/date:block' : 'fy:hidden fy:group-data-[popup-open]/time:block'}
      />
    </span>
  );
}

/** A press on the field itself is the field's own toggle, not "outside". */
const keepOnOwnPress = (anchor: HTMLElement | null, details: Popover.Root.ChangeEventDetails): boolean => {
  if (details.reason === 'outside-press' && anchor?.contains(details.event.target as Node)) {
    details.cancel();
    return true;
  }
  return false;
};

interface PickerBase {
  onValueChange: (value: string) => void;
  /** Minutes between the offered minutes (time, datetime). */
  step?: number;
  size?: ControlSize;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  /** The page's locale (default: the screen's): its numerals, and Persian month names in Persian. */
  locale?: string;
  /** The popup closed, or focus left the closed field (the caller validates). */
  onBlur?: () => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  className?: string;
}

export interface DatePickerProps extends PickerBase {
  /** `date`: `Y-m-d`. `datetime`: `Y-m-d H:i:s` in UTC, shown in the site's time. '' = nothing. */
  kind?: 'date' | 'datetime';
  value: string;
  /** The calendar the field writes in; `auto` = the site's, with the switch in the panel. */
  calendar?: CalendarKind | 'auto';
  /** The earliest / latest value: stored format, or `today` (date) / `now` (datetime). */
  min?: string;
  max?: string;
}

/** A range's own ends (Date Range Picker); not in the SDK. */
interface RangeEndProps {
  /**
   * One end of a Date Range Field: no chevron and no Equivalent line (Figma draws the icon and the value only). A time's
   * clock icon then opens its panel.
   */
  bare?: boolean;
}

export interface DatePickerInternalProps extends DatePickerProps, RangeEndProps {
  /** A stored value whose month the panel shows while the field is empty (a range's end opens on its start's month). */
  openOn?: string;
}

/**
 * Figma "Date Field": the Select anatomy (calendar icon, value, chevron) that opens the Calendar Panel under it; a datetime
 * field opens it with the time columns. Under a filled field, the same value in the other calendar (Figma "Equivalent").
 * Inside a Setting Row (or a FieldShell) the row names and describes it; on its own, give it an `aria-label`.
 */
export function DatePicker({
  kind = 'date',
  value,
  onValueChange,
  calendar: setting = 'auto',
  min,
  max,
  openOn,
  step = 1,
  size = 'sm',
  placeholder,
  disabled,
  name,
  id,
  locale: localeProp,
  onBlur,
  bare = false,
  className,
  ...aria
}: DatePickerInternalProps): ReactElement {
  const locale = useScreenLocale(localeProp);
  const anchor = useRef<HTMLDivElement | null>(null);
  const control = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  // Mounted on first open and kept: Base UI's Popover then runs its own enter / exit and returns focus to the field.
  const [loaded, setLoaded] = useState(false);

  const calendar = initialCalendar(setting);
  const text = formatValue(kind, value, calendar, locale);
  const equivalent = text === '' || bare ? '' : equivalentText(kind, value, calendar, locale);
  // In a Setting Row the Equivalent is one of the field's descriptions; on its own the picker links it itself.
  const inField = useContext(InFieldRoot);
  const equivalentId = useId();
  const describedBy = !inField && equivalent !== '' ? { 'aria-describedby': equivalentId } : {};

  const show = (): void => {
    setLoaded(true);
    setOpen(true);
  };
  const close = (): void => {
    setOpen(false);
    onBlur?.();
  };

  return (
    <div ref={anchor} data-slot="fy-date-picker" className={cn('fy:flex fy:w-full fy:flex-col fy:gap-2', className)}>
      <Field.Control
        {...aria}
        {...describedBy}
        ref={control}
        id={id}
        name={name}
        disabled={disabled}
        data-slot="fy-date-field"
        data-popup-open={open ? '' : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
          if (event.key !== 'ArrowDown' || open) return;
          event.preventDefault();
          show();
        }}
        onBlur={() => {
          // Focus moving into the open panel is not leaving the field; closing the panel reports it instead.
          if (!open) onBlur?.();
        }}
        render={<button type="button" />}
        className={cn('fy:group/date fy:cursor-pointer fy:text-start fy:focus-visible:border-focus-border fy:focus-visible:shadow-focus-input fy:focus-none', CONTROL_BASE, CONTROL_SIZE[size])}
      >
        <span className={GLYPH}>
          <Icon name="calendar" size={16} />
        </span>
        {text === '' ? (
          <span className="fy:min-w-0 fy:flex-1 fy:truncate fy:text-text-tertiary fy:group-data-[disabled]/field:text-text-disabled">
            {placeholder || (kind === 'datetime' ? __('Pick a date and time…', 'fyldo') : __('Pick a date…', 'fyldo'))}
          </span>
        ) : (
          <span data-slot="fy-date-value" className="fy:min-w-0 fy:flex-1 fy:truncate">
            {text}
          </span>
        )}
        {bare ? null : <Chevron group="date" />}
      </Field.Control>
      {equivalent !== '' && inField ? (
        <Field.Description data-slot="fy-date-equivalent" className="fy:text-copy-13 fy:text-text-tertiary fy:group-data-[disabled]/field:text-text-disabled">
          {equivalent}
        </Field.Description>
      ) : equivalent !== '' ? (
        <p id={equivalentId} data-slot="fy-date-equivalent" className="fy:text-copy-13 fy:text-text-tertiary">
          {equivalent}
        </p>
      ) : null}

      {loaded ? (
        <Suspense fallback={null}>
          <CalendarPopover
            open={open}
            anchorRef={anchor}
            returnFocusRef={control}
            label={kind === 'datetime' ? __('Choose a date and time', 'fyldo') : __('Choose a date', 'fyldo')}
            kind={kind}
            value={value}
            calendar={calendar}
            switchable={setting === 'auto'}
            min={min === undefined ? undefined : resolveBound(kind, min)}
            max={max === undefined ? undefined : resolveBound(kind, max)}
            openOn={openOn}
            step={step}
            locale={locale}
            onValueChange={onValueChange}
            onPick={kind === 'date' ? close : undefined}
            onOpenChange={(next, details) => {
              if (!next && keepOnOwnPress(anchor.current, details)) return;
              if (next) show();
              else close();
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

export interface TimePickerProps extends PickerBase {
  /** `H:i` (24-hour), or ''. Text that could not be read as a time is kept, so the `time` rule can report it. */
  value: string;
}

/**
 * The time field: HH:MM typed into the field (Persian and Arabic digits are read as ASCII; `930` is 09:30), or picked from
 * the Time Panel that the chevron opens (an Hour and a Minute listbox, minutes on the field's step, and "Now"). The time
 * is always written left to right, hours then minutes.
 */
export function TimePicker({
  value,
  onValueChange,
  step = 1,
  size = 'sm',
  placeholder,
  disabled,
  name,
  id,
  locale: localeProp,
  onBlur,
  bare = false,
  className,
  ...aria
}: TimePickerProps & RangeEndProps): ReactElement {
  const locale = useScreenLocale(localeProp);
  const anchor = useRef<HTMLDivElement | null>(null);
  const input = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const shown = (v: string): string => formatValue('time', v, 'gregorian', locale) || v;
  const [text, setText] = useState(() => shown(value));
  const [seen, setSeen] = useState(value);
  // A value set from outside (the panel, Now, a reset) replaces what is in the box.
  if (value !== seen) {
    setSeen(value);
    setText(shown(value));
  }

  const commit = (): void => {
    const next = readTypedTime(text);
    setText(shown(next));
    if (next !== value) {
      setSeen(next);
      onValueChange(next);
    }
  };

  const show = (): void => {
    commit();
    setLoaded(true);
    setOpen(true);
  };
  const close = (): void => {
    setOpen(false);
    onBlur?.();
  };

  const time: Time | null = parseTime(value);

  const clock = (
    <span className={GLYPH}>
      <Icon name="clock" size={16} />
    </span>
  );
  // The button that opens the panel: the chevron, or the clock in a range (a text box cannot carry aria-expanded).
  const toggle = (glyph: ReactElement): ReactElement => (
    <Tooltip label={__('Choose a time', 'fyldo')}>
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={__('Choose a time', 'fyldo')}
        onClick={() => (open ? close() : show())}
        className="fy:flex fy:cursor-pointer fy:outline-none fy:disabled:cursor-not-allowed"
      >
        {glyph}
      </button>
    </Tooltip>
  );

  return (
    <div
      ref={anchor}
      data-slot="fy-time-picker"
      data-popup-open={open ? '' : undefined}
      className={cn('fy:group/time fy:cursor-text', CONTROL_BASE, CONTROL_SIZE[size], className)}
    >
      {bare ? toggle(clock) : clock}
      <Field.Control
        {...aria}
        ref={input}
        id={id}
        name={name}
        disabled={disabled}
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder || '--:--'}
        value={text}
        onValueChange={(next) => setText(String(next))}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'ArrowDown' && (event.altKey || !open)) {
            event.preventDefault();
            show();
          }
        }}
        onBlur={() => {
          commit();
          if (!open) onBlur?.();
        }}
        className="fy:min-w-0 fy:flex-1 fy:bg-transparent fy:text-start fy:outline-none fy:placeholder:text-text-tertiary fy:focus-none fy:rtl:text-right fy:group-data-[disabled]/field:cursor-not-allowed"
      />
      {bare ? null : toggle(<Chevron group="time" />)}

      {loaded ? (
        <Suspense fallback={null}>
          <TimePopover
            open={open}
            anchorRef={anchor}
            returnFocusRef={input}
            label={__('Choose a time', 'fyldo')}
            value={time}
            step={step}
            locale={locale}
            onValueChange={(next) => onValueChange(formatTime(next))}
            onNow={() => {
              onValueChange(formatTime(nowOnStep(step)));
              close();
            }}
            onOpenChange={(next, details) => {
              if (!next && keepOnOwnPress(anchor.current, details)) return;
              if (next) show();
              else close();
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
