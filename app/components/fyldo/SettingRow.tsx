import { Field } from '@base-ui/react/field';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { FieldError } from '../ui/field-shell';

export interface SettingRowProps {
  title: string;
  description?: string;
  /** Why the control is disabled (rendered under the description). */
  disabledReason?: string;
  /** Short status label next to the title ("Pro", "Beta"). */
  badge?: ReactNode;
  /** `inline`: on/off controls at the end of the row. `stacked`: inputs under the description. */
  layout?: 'inline' | 'stacked';
  /** Bottom divider; off on the last row of a card. */
  divider?: boolean;
  error?: string;
  disabled?: boolean;
  name?: string;
  /** Field id, exposed for focusing the first invalid field. */
  fieldId?: string;
  children: ReactNode;
}

/**
 * Figma "Setting Row": title + description on the start side, control on the end (inline) or below (stacked).
 * It IS the Base UI Field: the title is the control's label, the description its `aria-describedby`.
 */
export function SettingRow({
  title,
  description,
  disabledReason,
  badge,
  layout = 'stacked',
  divider = true,
  error,
  disabled,
  name,
  fieldId,
  children,
}: SettingRowProps): ReactElement {
  const inline = layout === 'inline';

  return (
    <Field.Root
      invalid={Boolean(error)}
      disabled={disabled}
      name={name}
      data-slot="fy-setting-row"
      data-field-id={fieldId}
      className={cn(
        'fy:group/field fy:flex fy:py-5',
        inline ? 'fy:items-center fy:gap-8' : 'fy:flex-col fy:gap-3',
        divider && 'fy:border-b fy:border-border-default',
      )}
    >
      <div className={cn('fy:flex fy:min-w-0 fy:flex-col fy:gap-1', inline && 'fy:flex-1')}>
        <div className="fy:flex fy:items-center fy:gap-2">
          <Field.Label className="fy:text-label-14-strong fy:text-text-primary fy:data-[disabled]:text-text-disabled">{title}</Field.Label>
          {badge}
        </div>
        {description ? (
          <Field.Description className="fy:text-copy-13 fy:text-text-secondary fy:group-data-[disabled]/field:text-text-disabled">
            {description}
          </Field.Description>
        ) : null}
        {disabledReason ? <p className="fy:text-copy-13 fy:text-text-secondary">{disabledReason}</p> : null}
      </div>

      <div className={cn('fy:flex fy:flex-col fy:gap-2', inline ? 'fy:shrink-0' : 'fy:w-80 fy:max-w-full')}>
        {children}
        {error && !inline ? <FieldError>{error}</FieldError> : null}
      </div>
      {error && inline ? <FieldError>{error}</FieldError> : null}
    </Field.Root>
  );
}
