import { Field } from '@base-ui/react/field';
import type { ReactElement, ReactNode } from 'react';
import { Icon } from '../../icons/Icon';
import { cn } from '../../lib/cn';

export interface FieldShellProps {
  /** Every control has a name: visible, or `hideLabel` + it is still announced. */
  label: string;
  hideLabel?: boolean;
  /** Figma "Helper text". Replaced by `error` while the field is invalid. */
  description?: string;
  /** Figma "Error message". */
  error?: string;
  /** Replaces the helper/error row (Textarea puts its counter there). `error` still marks the field invalid. */
  footer?: ReactNode;
  disabled?: boolean;
  name?: string;
  className?: string;
  children: ReactNode;
}

/** Error row: 16px `info-circle` + Copy/13 in `status/error/text`. */
export function FieldError({ children, className }: { children: ReactNode; className?: string }): ReactElement {
  return (
    <Field.Error match className={cn('fy:flex fy:items-start fy:gap-1.5 fy:text-copy-13 fy:text-status-error-text', className)} data-slot="fy-field-error">
      <Icon name="info-circle" size={16} className="fy:mt-px" />
      <span>{children}</span>
    </Field.Error>
  );
}

/**
 * Figma "Input" anatomy around any control: label → control → helper (or error), 8px gaps.
 * Base UI's Field wires ids, `aria-describedby` and `aria-invalid`.
 */
export function FieldShell({ label, hideLabel, description, error, footer, disabled, name, className, children }: FieldShellProps): ReactElement {
  return (
    <Field.Root invalid={Boolean(error)} disabled={disabled} name={name} className={cn('fy:group/field fy:flex fy:w-full fy:flex-col fy:gap-2', className)}>
      <Field.Label
        className={cn(
          'fy:text-label-14-strong fy:text-text-primary fy:data-[disabled]:text-text-disabled',
          hideLabel && 'fy:sr-only',
        )}
      >
        {label}
      </Field.Label>
      {children}
      {footer !== undefined ? (
        footer
      ) : error ? (
        <FieldError>{error}</FieldError>
      ) : description ? (
        <Field.Description className="fy:text-copy-13 fy:text-text-secondary">
          {description}
        </Field.Description>
      ) : null}
    </Field.Root>
  );
}
