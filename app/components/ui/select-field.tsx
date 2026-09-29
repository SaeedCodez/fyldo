import type { ReactElement } from 'react';
import { FieldShell, type FieldShellProps } from './field-shell';
import { Select, type SelectProps } from './select';

export interface SelectFieldProps extends Omit<SelectProps, 'disabled' | 'name' | 'className'>, Omit<FieldShellProps, 'children' | 'className'> {
  className?: string;
}

/** Figma "Select": label → control → helper (or error). */
export function SelectField({ label, hideLabel, description, error, disabled, name, className, ...select }: SelectFieldProps): ReactElement {
  return (
    <FieldShell label={label} hideLabel={hideLabel} description={description} error={error} disabled={disabled} name={name} className={className}>
      <Select {...select} disabled={disabled} />
    </FieldShell>
  );
}
