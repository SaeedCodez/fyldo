import type { ReactElement } from 'react';
import { FieldShell, type FieldShellProps } from './field-shell';
import { IconPicker, type IconPickerProps } from './icon-picker';

export interface IconPickerFieldProps extends Omit<IconPickerProps, 'disabled' | 'name' | 'className'>, Omit<FieldShellProps, 'children' | 'className'> {
  className?: string;
}

/** Figma "Icon Picker": label → control → helper (or error). Setting Rows use `IconPicker` directly. */
export function IconPickerField({ label, hideLabel, description, error, disabled, name, className, ...picker }: IconPickerFieldProps): ReactElement {
  return (
    <FieldShell label={label} hideLabel={hideLabel} description={description} error={error} disabled={disabled} name={name} className={className}>
      <IconPicker {...picker} disabled={disabled} />
    </FieldShell>
  );
}
