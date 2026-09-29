import { Field } from '@base-ui/react/field';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface OptionDef {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface OptionItemProps {
  label: string;
  description?: string;
  disabled?: boolean;
  /** The 16px control (Checkbox / Radio). */
  control: ReactNode;
  className?: string;
}

/**
 * Figma Checkbox / Radio anatomy: a 16px control centred on the first text line (its slot is one line tall, 20px in
 * English, 22px in Persian), 8px gap, Label/14 and an optional Copy/13 description 2px below it. The control and the
 * label are one `<label>`: the whole row is the click target. A Base UI `Field.Item`, so every option of a group has its
 * own label and description. Must be inside a Base UI `Field.Root` (Setting Row / GroupField).
 */
export function OptionItem({ label, description, disabled, control, className }: OptionItemProps): ReactElement {
  return (
    <Field.Item disabled={disabled} data-slot="fy-option" className={cn('fy:group/option fy:flex fy:flex-col fy:gap-0.5', className)}>
      <Field.Label className="fy:flex fy:cursor-pointer fy:items-start fy:gap-2 fy:data-[disabled]:cursor-not-allowed">
        <span className="fy:flex fy:h-(--fyldo-leading-label-14) fy:shrink-0 fy:items-center">{control}</span>
        <span className="fy:text-label-14 fy:text-text-primary fy:group-data-[disabled]/option:text-text-disabled">{label}</span>
      </Field.Label>
      {description ? (
        <Field.Description className="fy:ps-6 fy:text-copy-13 fy:text-text-secondary fy:group-data-[disabled]/option:text-text-disabled">{description}</Field.Description>
      ) : null}
    </Field.Item>
  );
}

/** Options stack vertically with 12px gaps (Figma: "Stack options vertically with 12px gaps"). */
export const OPTION_LIST = 'fy:flex fy:flex-col fy:gap-3';
