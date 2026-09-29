import type { ReactElement } from 'react';
import { FieldShell, type FieldShellProps } from './field-shell';
import { MultiSelect, type MultiSelectProps } from './multi-select';

export interface MultiSelectFieldProps extends Omit<MultiSelectProps, 'disabled' | 'name' | 'className'>, Omit<FieldShellProps, 'children' | 'className'> {
  className?: string;
}

/** Figma "Multi Select": label → control → helper (or error). */
export function MultiSelectField({ label, hideLabel, description, error, disabled, name, className, ...select }: MultiSelectFieldProps): ReactElement {
  return (
    <FieldShell label={label} hideLabel={hideLabel} description={description} error={error} disabled={disabled} name={name} className={className}>
      <MultiSelect aria-label={label} {...select} disabled={disabled} />
    </FieldShell>
  );
}
