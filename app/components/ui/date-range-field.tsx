import { Field } from '@base-ui/react/field';
import { useId, useRef, type ReactElement } from 'react';
import { Icon } from '../../icons/Icon';
import { __ } from '../../i18n';
import { cn } from '../../lib/cn';
import { useScreenLocale } from '../../lib/portal';
import { durationText, rangeEndMin, type CalendarKind, type MomentKind } from '../../lib/datetime';
import type { DateRangeValue } from '../../types';
import type { ControlSize } from './control';
import { DatePicker, TimePicker } from './date-picker';
import { GroupLabelProvider, useGroupLabels } from './group-field';

export type RangeEnd = 'start' | 'end';

export interface DateRangePickerProps {
  /** `date` (`Y-m-d`), `time` (`H:i`) or `datetime` (`Y-m-d H:i:s` in UTC) at both ends. */
  kind?: MomentKind;
  /** Both ends in the stored format; nothing = both ''. */
  value: DateRangeValue;
  onValueChange: (value: DateRangeValue) => void;
  /** The calendar both ends write in (date, datetime); `auto` = the site's, with the switch in the panel. */
  calendar?: CalendarKind | 'auto';
  /** The earliest / latest value of either end: stored format, or `today` (date) / `now` (datetime). */
  min?: string;
  max?: string;
  /** Minutes between the offered minutes (time, datetime). */
  step?: number;
  size?: ControlSize;
  /** Both ends' placeholder, unless an end has its own. */
  placeholder?: string;
  startPlaceholder?: string;
  endPlaceholder?: string;
  disabled?: boolean;
  /** Figma "Error message", under the inputs. */
  error?: string;
  /** The end the error is about, drawn in red (Figma: the end). */
  invalid?: RangeEnd;
  /** The page's locale (default: the screen's): its numerals, and Persian month names in Persian. */
  locale?: string;
  /** Focus left the range (both inputs and their popups): the caller validates. */
  onBlur?: () => void;
  className?: string;
}

/** The ends' default names (their placeholders and accessible names). */
function endNames(kind: MomentKind): [string, string] {
  return kind === 'time' ? [__('Start time', 'fyldo'), __('End time', 'fyldo')] : [__('Start date', 'fyldo'), __('End date', 'fyldo')];
}

/**
 * Figma "Date Range Field" without its label: two single pickers, start → end, the Duration once both ends are set, and the
 * error. Each input opens the single picker's own popup and sets only its end; a date or datetime end opens on the start's
 * month with everything before the start disabled, and a start moved past the end clears the end. A time range may cross
 * midnight. The ends sit in reading order (the start on the right in RTL), the arrow pointing from start to end. Use inside
 * a Setting Row with `group` and `ownError`, or through `DateRangeField`.
 */
export function DateRangePicker({
  kind = 'date',
  value,
  onValueChange,
  calendar = 'auto',
  min,
  max,
  step,
  size = 'sm',
  placeholder,
  startPlaceholder,
  endPlaceholder,
  disabled,
  error,
  invalid = 'end',
  locale: localeProp,
  onBlur,
  className,
}: DateRangePickerProps): ReactElement {
  const locale = useScreenLocale(localeProp);
  const root = useRef<HTMLDivElement | null>(null);
  const labels = useGroupLabels();
  const ids = { start: useId(), end: useId(), startName: useId(), endName: useId(), duration: useId(), error: useId() };
  const [startName, endName] = endNames(kind);
  const duration = durationText(kind, value.start, value.end, locale);
  const describedBy = [labels['aria-describedby'], duration ? ids.duration : '', error ? ids.error : ''].filter(Boolean).join(' ');

  // A popup closing returns focus to its input: only focus that ends up outside both inputs (and their popups) is leaving.
  const report = (): void => {
    window.setTimeout(() => {
      if (!root.current?.contains(document.activeElement)) onBlur?.();
    }, 0);
  };

  const setStart = (start: string): void => {
    // A date or datetime start moved past the end clears the end; a time range may cross midnight.
    const past = kind !== 'time' && start !== '' && value.end !== '' && start > value.end;
    onValueChange({ start, end: past ? '' : value.end });
  };

  const end = (which: RangeEnd): ReactElement => {
    const own = which === 'start' ? startPlaceholder : endPlaceholder;
    const name = which === 'start' ? startName : endName;
    const common = {
      id: ids[which],
      size,
      placeholder: own || placeholder || name,
      disabled,
      locale,
      step,
      bare: true,
      onBlur: report,
    };
    return (
      // Its own Field: only the end at fault turns red (the Setting Row around the range stays valid).
      <Field.Root invalid={Boolean(error) && invalid === which} disabled={disabled} className="fy:group/field fy:min-w-0 fy:flex-1">
        <span id={which === 'start' ? ids.startName : ids.endName} hidden>
          {name}
        </span>
        {kind === 'time' ? (
          <TimePicker
            {...common}
            aria-label={name}
            value={which === 'start' ? value.start : value.end}
            onValueChange={(next) => (which === 'start' ? setStart(next) : onValueChange({ start: value.start, end: next }))}
          />
        ) : (
          <DatePicker
            {...common}
            aria-labelledby={`${which === 'start' ? ids.startName : ids.endName} ${ids[which]}`}
            kind={kind}
            calendar={calendar}
            value={which === 'start' ? value.start : value.end}
            min={which === 'start' ? min : rangeEndMin(kind, min, value.start)}
            max={max}
            openOn={which === 'end' && value.start !== '' ? value.start : undefined}
            onValueChange={(next) => (which === 'start' ? setStart(next) : onValueChange({ start: value.start, end: next }))}
          />
        )}
      </Field.Root>
    );
  };

  return (
    <div
      ref={root}
      role="group"
      aria-labelledby={labels['aria-labelledby']}
      aria-describedby={describedBy || undefined}
      data-slot="fy-date-range"
      className={cn('fy:flex fy:w-full fy:flex-col fy:gap-2', className)}
    >
      <div data-slot="fy-date-range-controls" className="fy:flex fy:items-center fy:gap-2">
        {end('start')}
        <span className="fy:flex fy:shrink-0 fy:text-icon-tertiary fy:group-data-[disabled]/field:text-text-disabled">
          <Icon name="arrow-right" size={16} className="fy:rtl:-scale-x-100" />
        </span>
        {end('end')}
      </div>
      {duration !== '' ? (
        <p id={ids.duration} data-slot="fy-date-range-duration" className="fy:text-copy-13 fy:text-text-secondary fy:group-data-[disabled]/field:text-text-disabled">
          {duration}
        </p>
      ) : null}
      {error ? (
        // The look of FieldError; a plain element, so the group can point at it.
        <div id={ids.error} data-slot="fy-field-error" className="fy:flex fy:items-start fy:gap-1.5 fy:text-copy-13 fy:text-status-error-text">
          <Icon name="info-circle" size={16} className="fy:mt-px" />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}

export interface DateRangeFieldProps extends Omit<DateRangePickerProps, 'className'> {
  /** The question the range answers ("Sale period"): names the group. */
  label: string;
  hideLabel?: boolean;
  /** Figma "Helper text". Replaced by `error` while the range is invalid. */
  description?: string;
  name?: string;
  className?: string;
}

/** Figma "Date Range Field": label → the two inputs → Duration → helper (or error). Setting Rows use `DateRangePicker`. */
export function DateRangeField({ label, hideLabel, description, name, className, ...picker }: DateRangeFieldProps): ReactElement {
  const titleId = useId();
  const descriptionId = useId();
  const helper = description && !picker.error ? description : '';
  return (
    <Field.Root disabled={picker.disabled} name={name} className={cn('fy:group/field fy:flex fy:w-full fy:flex-col fy:gap-2', className)}>
      <div id={titleId} className={cn('fy:text-label-14-strong fy:text-text-primary fy:group-data-[disabled]/field:text-text-disabled', hideLabel && 'fy:sr-only')}>
        {label}
      </div>
      <GroupLabelProvider titleId={titleId} descriptionId={helper ? descriptionId : undefined}>
        <DateRangePicker {...picker} />
      </GroupLabelProvider>
      {helper ? (
        <p id={descriptionId} className="fy:text-copy-13 fy:text-text-secondary fy:group-data-[disabled]/field:text-text-disabled">
          {helper}
        </p>
      ) : null}
    </Field.Root>
  );
}
