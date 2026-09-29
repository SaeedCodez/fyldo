import { Field } from '@base-ui/react/field';
import { useId, type ReactElement, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { FieldError } from '../ui/field-shell';
import { GroupLabelProvider } from '../ui/group-field';

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
  /** The control renders its own error row (Textarea: the counter shares it). */
  errorInControl?: boolean;
  /** The control is a group (checkbox group, radio group): the title names the group instead of labelling one control. */
  group?: boolean;
  /** Figma Textarea is 360 wide; every other control 320. */
  wide?: boolean;
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
  errorInControl = false,
  group = false,
  wide = false,
  disabled,
  name,
  fieldId,
  children,
}: SettingRowProps): ReactElement {
  const inline = layout === 'inline';
  const titleId = useId();
  const descriptionId = useId();

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
          {group ? (
            <div id={titleId} className="fy:text-label-14-strong fy:text-text-primary fy:group-data-[disabled]/field:text-text-disabled">
              {title}
            </div>
          ) : (
            <Field.Label className="fy:text-label-14-strong fy:text-text-primary fy:data-[disabled]:text-text-disabled">{title}</Field.Label>
          )}
          {badge}
        </div>
        {description ? (
          group ? (
            // A group's description belongs to the group, not to each of its options: plain text, linked by aria-describedby.
            <p id={descriptionId} className="fy:text-copy-13 fy:text-text-secondary fy:group-data-[disabled]/field:text-text-disabled">
              {description}
            </p>
          ) : (
            <Field.Description className="fy:text-copy-13 fy:text-text-secondary fy:group-data-[disabled]/field:text-text-disabled">{description}</Field.Description>
          )
        ) : null}
        {disabledReason ? <p className="fy:text-copy-13 fy:text-text-secondary">{disabledReason}</p> : null}
      </div>

      <div className={cn('fy:flex fy:flex-col fy:gap-2', inline ? 'fy:shrink-0' : cn(wide ? 'fy:w-90' : 'fy:w-80', 'fy:max-w-full'))}>
        {group ? (
          <GroupLabelProvider titleId={titleId} descriptionId={description ? descriptionId : undefined}>
            {children}
          </GroupLabelProvider>
        ) : (
          children
        )}
        {error && !inline && !errorInControl ? <FieldError>{error}</FieldError> : null}
      </div>
      {error && inline && !errorInControl ? <FieldError>{error}</FieldError> : null}
    </Field.Root>
  );
}
