import type { ReactElement } from 'react';
import { ColorPicker, type ColorPickerProps } from './color-picker';
import { FieldShell, type FieldShellProps } from './field-shell';

export interface ColorPickerFieldProps extends Omit<ColorPickerProps, 'disabled' | 'name' | 'className'>, Omit<FieldShellProps, 'children' | 'className'> {
  className?: string;
}

/** Figma "Color Picker": label → control → helper (or error). Setting Rows use `ColorPicker` directly. */
export function ColorPickerField({ label, hideLabel, description, error, disabled, name, className, ...picker }: ColorPickerFieldProps): ReactElement {
  return (
    <FieldShell label={label} hideLabel={hideLabel} description={description} error={error} disabled={disabled} name={name} className={className}>
      <ColorPicker {...picker} disabled={disabled} />
    </FieldShell>
  );
}
