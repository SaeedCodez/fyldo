import type { ReactElement } from 'react';
import { DatePicker, TimePicker, type DatePickerProps, type TimePickerProps } from './date-picker';
import { FieldShell, type FieldShellProps } from './field-shell';

type Shell = Omit<FieldShellProps, 'children' | 'className'>;

export interface DateFieldProps extends Omit<DatePickerProps, 'disabled' | 'name' | 'className'>, Shell {
  className?: string;
}

/** Figma "Date Field": label → control → equivalent → helper (or error). Setting Rows use `DatePicker` directly. */
export function DateField({ label, hideLabel, description, error, disabled, name, className, ...picker }: DateFieldProps): ReactElement {
  return (
    <FieldShell label={label} hideLabel={hideLabel} description={description} error={error} disabled={disabled} name={name} className={className}>
      <DatePicker {...picker} disabled={disabled} />
    </FieldShell>
  );
}

export interface TimeFieldProps extends Omit<TimePickerProps, 'disabled' | 'name' | 'className'>, Shell {
  className?: string;
}

/** The time field with its label and helper (or error). Setting Rows use `TimePicker` directly. */
export function TimeField({ label, hideLabel, description, error, disabled, name, className, ...picker }: TimeFieldProps): ReactElement {
  return (
    <FieldShell label={label} hideLabel={hideLabel} description={description} error={error} disabled={disabled} name={name} className={className}>
      <TimePicker {...picker} disabled={disabled} />
    </FieldShell>
  );
}
