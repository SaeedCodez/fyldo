import type { ReactElement } from 'react';
import { FieldShell, type FieldShellProps } from './field-shell';
import { Input, type InputProps } from './input';

export interface TextFieldProps extends Omit<InputProps, 'children'>, Omit<FieldShellProps, 'children' | 'className'> {
  className?: string;
}

/** Figma "Input": label → control → helper (or error). For standalone use (dialogs, filters); Setting Rows use `Input` directly. */
export function TextField({ label, hideLabel, description, error, disabled, name, className, ...input }: TextFieldProps): ReactElement {
  return (
    <FieldShell label={label} hideLabel={hideLabel} description={description} error={error} disabled={disabled} name={name} className={className}>
      <Input {...input} disabled={disabled} />
    </FieldShell>
  );
}
