import { Field } from '@base-ui/react/field';
import { useId, type ReactElement } from 'react';
import { cn } from '../../lib/cn';
import { ChoiceCards, type ChoiceCardsProps } from './choice-card';
import { GroupLabelProvider } from './group-field';

export interface ChoiceCardGroupProps extends Omit<ChoiceCardsProps, 'name' | 'className' | 'aria-labelledby' | 'aria-describedby'> {
  /** Names the group for assistive technology. */
  label: string;
  hideLabel?: boolean;
  /** Figma "Helper text". Replaced by `error` while nothing is selected on a required group. */
  description?: string;
  /** Figma "Error message". */
  error?: string;
  className?: string;
}

/**
 * Figma Choice Card Group: label (Label/14 Strong) → cards → helper (Copy/13) or error text, 8px gaps. The error row is
 * text only (no icon), as drawn. Fills its container (576 in the pack); inside a page a Setting Row does this job.
 */
export function ChoiceCardGroup({ label, hideLabel, description, error, className, disabled, ...cards }: ChoiceCardGroupProps): ReactElement {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Field.Root invalid={Boolean(error)} disabled={disabled} className={cn('fy:group/field fy:flex fy:w-full fy:flex-col fy:gap-2', className)} data-slot="fy-choice-card-group">
      <div id={titleId} className={cn('fy:text-label-14-strong fy:text-text-primary fy:group-data-[disabled]/field:text-text-disabled', hideLabel && 'fy:sr-only')}>
        {label}
      </div>
      <GroupLabelProvider titleId={titleId} descriptionId={description && !error ? descriptionId : undefined}>
        <ChoiceCards {...cards} disabled={disabled} />
      </GroupLabelProvider>
      {error ? (
        <Field.Error match className="fy:text-copy-13 fy:text-status-error-text" data-slot="fy-field-error">
          {error}
        </Field.Error>
      ) : description ? (
        <p id={descriptionId} className="fy:text-copy-13 fy:text-text-secondary fy:group-data-[disabled]/field:text-text-disabled">
          {description}
        </p>
      ) : null}
    </Field.Root>
  );
}
