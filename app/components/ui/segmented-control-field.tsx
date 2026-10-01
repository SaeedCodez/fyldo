import { Field } from '@base-ui/react/field';
import { useId, type ReactElement } from 'react';
import { cn } from '../../lib/cn';
import { FieldError } from './field-shell';
import { GroupLabelProvider } from './group-field';
import { SegmentedControl, type SegmentedControlProps } from './segmented-control';

export interface SegmentedControlFieldProps extends Omit<SegmentedControlProps, 'name' | 'className' | 'aria-label' | 'aria-labelledby' | 'aria-describedby'> {
  /** Names the group for assistive technology. */
  label: string;
  hideLabel?: boolean;
  description?: string;
  error?: string;
  className?: string;
}

/** Stand-alone Segmented Control: label → control → helper (or error), 8px gaps. Inside a page a Setting Row does this job. */
export function SegmentedControlField({ label, hideLabel, description, error, className, disabled, ...control }: SegmentedControlFieldProps): ReactElement {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Field.Root invalid={Boolean(error)} disabled={disabled} className={cn('fy:group/field fy:flex fy:flex-col fy:gap-2', className)} data-slot="fy-segmented-control-field">
      <div id={titleId} className={cn('fy:text-label-14-strong fy:text-text-primary fy:group-data-[disabled]/field:text-text-disabled', hideLabel && 'fy:sr-only')}>
        {label}
      </div>
      <GroupLabelProvider titleId={titleId} descriptionId={description && !error ? descriptionId : undefined}>
        <SegmentedControl {...control} disabled={disabled} />
      </GroupLabelProvider>
      {error ? (
        <FieldError>{error}</FieldError>
      ) : description ? (
        <p id={descriptionId} className="fy:text-copy-13 fy:text-text-secondary fy:group-data-[disabled]/field:text-text-disabled">
          {description}
        </p>
      ) : null}
    </Field.Root>
  );
}
