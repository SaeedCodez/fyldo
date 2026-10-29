import { Field } from '@base-ui/react/field';
import { useId, type ReactElement, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { FieldError, InFieldRoot } from '../ui/field-shell';
import { GroupLabelProvider } from '../ui/group-field';

/** The control's width in a stacked or `field` row. */
export type SettingRowWidth = 'default' | 'wide' | 'cards' | 'range' | 'full';

export interface SettingRowProps {
  title: string;
  description?: string;
  /** Why the control is disabled: shown under the description and part of the control's accessible description. */
  disabledReason?: string;
  /** Short status label next to the title ("Pro", "Beta"). */
  badge?: ReactNode;
  /**
   * `inline`: on/off controls at the end of the row. `stacked`: inputs under the description. `field`: an input at the end
   * of the row (stacked width, error under it); at ≤782px it falls back to `stacked`.
   */
  layout?: 'inline' | 'stacked' | 'field';
  /** Bottom divider; off on the last row of a card. */
  divider?: boolean;
  error?: string;
  /** The control is a group (checkbox group, radio group): the title names the group instead of labelling one control. */
  group?: boolean;
  /**
   * The control's width, as Figma draws it: `default` 400, `wide` 448 (Textarea, Media Picker), `cards` 576 (Choice
   * Cards), `range` 480 (Date Range Picker), `full` the whole row (Group List, Code Editor). Like every stacked control
   * it shrinks (`max-w-full`) on narrow containers.
   */
  width?: SettingRowWidth;
  disabled?: boolean;
  children: ReactNode;
}

/** What Fyldo's own fields pass as well (FieldRenderer); not in the SDK. */
export interface SettingRowInternalProps extends SettingRowProps {
  /** Extra state for screen readers only (a password that is already set), described like the description. */
  srNote?: string;
  /** The control renders its own error row (Textarea: the counter shares it). */
  errorInControl?: boolean;
  /** The control renders its own error row and marks only the part at fault invalid (Date Range Field: the end in red). */
  ownError?: boolean;
  /**
   * `row`: a Setting Row of a Section Card. `item`: a sub-field inside a Group Item (Figma "Input" anatomy: label →
   * control → helper, no padding or divider; `field` reads as `stacked`, the control fills the column).
   */
  variant?: 'row' | 'item';
  name?: string;
  /** Field id, exposed for focusing the first invalid field. */
  fieldId?: string;
}

const WIDTH: Record<SettingRowWidth, string> = {
  default: 'fy:w-100',
  wide: 'fy:w-112',
  cards: 'fy:w-144',
  range: 'fy:w-120',
  full: 'fy:w-full',
};

/**
 * Figma "Setting Row": title + description on the start side, control on the end (inline) or below (stacked).
 * It IS the Base UI Field: the title is the control's label, the description its `aria-describedby`.
 */
export function SettingRow({
  title,
  description,
  disabledReason,
  srNote,
  badge,
  layout: requested = 'stacked',
  divider = true,
  error,
  errorInControl = false,
  ownError = false,
  group = false,
  width = 'default',
  variant = 'row',
  disabled,
  name,
  fieldId,
  children,
}: SettingRowInternalProps): ReactElement {
  const full = width === 'full';
  const item = variant === 'item';
  const layout = item && requested === 'field' ? 'stacked' : requested;
  const inline = layout === 'inline';
  const beside = inline || layout === 'field';
  // In an item the description is the helper under the control (and an error takes its place), as in Figma "Input".
  const helperBelow = item && !inline;
  const titleId = useId();
  const descriptionId = useId();
  const reasonId = useId();
  // A group control (checkbox group, radio group) is described by the ids of its row; the others by Base UI's Field.
  const groupDescribedBy = [description ? descriptionId : '', disabledReason ? reasonId : ''].filter(Boolean).join(' ');

  return (
    <Field.Root
      invalid={Boolean(error) && !ownError}
      disabled={disabled}
      name={name}
      data-slot="fy-setting-row"
      data-field-id={fieldId}
      className={cn(
        'fy:group/field fy:flex',
        !item && 'fy:py-6',
        // A full-width control (a Group's items) sits 16 below the title, as in Figma "Group"; other stacked controls 12.
        layout === 'stacked' && (item ? 'fy:flex-col fy:gap-2' : full ? 'fy:flex-col fy:gap-4' : 'fy:flex-col fy:gap-3'),
        inline && (item ? 'fy:items-center fy:gap-4' : 'fy:items-center fy:gap-8'),
        layout === 'field' && 'fy:items-center fy:gap-8 fy:wp-mobile:flex-col fy:wp-mobile:items-stretch fy:wp-mobile:gap-3',
        divider && !item && 'fy:border-b fy:border-border-subtle',
      )}
    >
      <div className={cn('fy:flex fy:min-w-0 fy:flex-col fy:gap-1', beside && 'fy:flex-1', layout === 'field' && 'fy:wp-mobile:flex-none')}>
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
        {description && !helperBelow ? (
          group ? (
            // A group's description belongs to the group, not to each of its options: plain text, linked by aria-describedby.
            <p id={descriptionId} className="fy:text-copy-13 fy:text-text-secondary fy:group-data-[disabled]/field:text-text-disabled">
              {description}
            </p>
          ) : (
            <Field.Description className="fy:text-copy-13 fy:text-text-secondary fy:group-data-[disabled]/field:text-text-disabled">{description}</Field.Description>
          )
        ) : null}
        {disabledReason ? (
          // Stays `text-secondary` even though the row is disabled: the reason is the one thing that must remain readable.
          group ? (
            <p id={reasonId} data-slot="fy-disabled-reason" className="fy:text-copy-13 fy:text-text-secondary">
              {disabledReason}
            </p>
          ) : (
            <Field.Description data-slot="fy-disabled-reason" className="fy:text-copy-13 fy:text-text-secondary">
              {disabledReason}
            </Field.Description>
          )
        ) : null}
        {srNote && !group ? <Field.Description className="fy:sr-only">{srNote}</Field.Description> : null}
      </div>

      <div
        className={cn(
          'fy:flex fy:flex-col fy:gap-2',
          inline ? 'fy:shrink-0' : cn(layout === 'field' && 'fy:shrink-0', item ? 'fy:w-full' : WIDTH[width], 'fy:max-w-full'),
        )}
      >
        <InFieldRoot.Provider value>
          {group ? (
            <GroupLabelProvider titleId={titleId} descriptionId={groupDescribedBy || undefined}>
              {children}
            </GroupLabelProvider>
          ) : (
            children
          )}
        </InFieldRoot.Provider>
        {error && !inline && !errorInControl && !ownError ? <FieldError>{error}</FieldError> : null}
        {helperBelow && description && !error ? (
          group ? (
            <p id={descriptionId} className="fy:text-copy-13 fy:text-text-secondary fy:group-data-[disabled]/field:text-text-disabled">
              {description}
            </p>
          ) : (
            <Field.Description className="fy:text-copy-13 fy:text-text-secondary fy:group-data-[disabled]/field:text-text-disabled">{description}</Field.Description>
          )
        ) : null}
      </div>
      {error && inline && !errorInControl && !ownError ? <FieldError>{error}</FieldError> : null}
    </Field.Root>
  );
}
