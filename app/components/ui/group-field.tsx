import { Field } from '@base-ui/react/field';
import { createContext, useContext, useId, type ReactElement, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { FieldError } from './field-shell';

interface GroupLabels {
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

const GroupLabelContext = createContext<GroupLabels>({});

/** ARIA wiring a group control takes from the row that shows its title (Setting Row, GroupField). */
export const useGroupLabels = (): GroupLabels => useContext(GroupLabelContext);

/** Provides the ids a group control needs to be named ("Show on") and described by its surrounding row. `descriptionId` may list several ids (description, disabled reason). */
export function GroupLabelProvider({ titleId, descriptionId, children }: { titleId: string; descriptionId?: string; children: ReactNode }): ReactElement {
  const labels: GroupLabels = { 'aria-labelledby': titleId, ...(descriptionId ? { 'aria-describedby': descriptionId } : {}) };
  return <GroupLabelContext.Provider value={labels}>{children}</GroupLabelContext.Provider>;
}

export interface GroupFieldProps {
  /** The question the group answers ("Show on", "Layout"): names the group for assistive technology. */
  label: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  name?: string;
  className?: string;
  /** A `CheckboxGroup` or `RadioGroup`. */
  children: ReactNode;
}

/**
 * Stand-alone group: label → description → options → error (Figma "Checkbox & Radio · Usage" cards). Inside a page use
 * a Setting Row instead; this is for dialogs and filters. The label is the group's name, not a `<label>` of one control.
 */
export function GroupField({ label, description, error, disabled, name, className, children }: GroupFieldProps): ReactElement {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Field.Root invalid={Boolean(error)} disabled={disabled} name={name} className={cn('fy:group/field fy:flex fy:flex-col', className)} data-slot="fy-group-field">
      <div id={titleId} className="fy:text-label-14-strong fy:text-text-primary fy:group-data-[disabled]/field:text-text-disabled">
        {label}
      </div>
      {description ? (
        <p id={descriptionId} className="fy:mt-1 fy:text-copy-13 fy:text-text-secondary">
          {description}
        </p>
      ) : null}
      <div className="fy:mt-4 fy:flex fy:flex-col fy:gap-2">
        <GroupLabelProvider titleId={titleId} descriptionId={description ? descriptionId : undefined}>
          {children}
        </GroupLabelProvider>
        {error ? <FieldError>{error}</FieldError> : null}
      </div>
    </Field.Root>
  );
}
