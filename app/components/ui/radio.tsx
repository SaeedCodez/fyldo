import { Radio as BaseRadio } from '@base-ui/react/radio';
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group';
import type { FocusEvent, ReactElement } from 'react';
import { cn } from '../../lib/cn';
import { useGroupLabels } from './group-field';
import { OPTION_LIST, OptionItem, type OptionDef } from './option-item';

/*
 * Figma Radio: 16px circle (`radius/full`), 1px `control/border` inside; checked = `control/on` fill, no stroke, a 6px
 * `control/thumb` dot. Hover / disabled follow Checkbox.
 */
const CIRCLE = [
  'fy:relative fy:inline-flex fy:size-4 fy:shrink-0 fy:items-center fy:justify-center fy:rounded-full fy:border',
  'fy:border-control-border fy:bg-background-default fy:transition-colors fy:duration-100 fy:ease-out',
  'fy:hover:border-control-border-hover fy:group-hover/option:border-control-border-hover',
  'fy:data-checked:border-0 fy:data-checked:bg-control-on fy:data-checked:hover:bg-control-on-hover fy:data-checked:group-hover/option:bg-control-on-hover',
  'fy:data-disabled:cursor-not-allowed fy:data-disabled:border-border-default fy:data-disabled:bg-surface-disabled',
  'fy:data-disabled:hover:border-border-default fy:data-disabled:group-hover/option:border-border-default',
  'fy:data-disabled:data-checked:border-0 fy:data-disabled:data-checked:bg-control-on-disabled fy:data-disabled:data-checked:hover:bg-control-on-disabled fy:data-disabled:data-checked:group-hover/option:bg-control-on-disabled',
  'fy:focus-ring',
].join(' ');

function Circle({ value, disabled }: { value: string; disabled?: boolean }): ReactElement {
  return (
    <BaseRadio.Root value={value} disabled={disabled} data-slot="fy-radio" className={CIRCLE}>
      <BaseRadio.Indicator className="fy:block fy:size-1.5 fy:rounded-full fy:bg-control-thumb" data-slot="fy-radio-dot" />
    </BaseRadio.Root>
  );
}

export interface RadioGroupProps {
  /** 2–5 visible options. More than that is a Select. */
  options: OptionDef[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  name?: string;
  className?: string;
  /** Focus left the group (bubbled `blur`; the caller decides whether it moved between options). */
  onBlur?: (event: FocusEvent<HTMLDivElement>) => void;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

/** Radio group (inside a Field: Setting Row / GroupField): exactly one option, always with a selection; options stack with 12px gaps. Arrow keys move the choice. */
export function RadioGroup({ options, value, onValueChange, disabled, name, className, ...aria }: RadioGroupProps): ReactElement {
  const labels = useGroupLabels();
  return (
    <BaseRadioGroup
      {...labels}
      {...aria}
      value={value}
      name={name}
      disabled={disabled}
      data-slot="fy-radio-group"
      onValueChange={(next) => onValueChange(String(next))}
      className={cn(OPTION_LIST, className)}
    >
      {options.map((option) => (
        <OptionItem
          key={option.value}
          label={option.label}
          description={option.description}
          disabled={disabled || option.disabled}
          control={<Circle value={option.value} disabled={disabled || option.disabled} />}
        />
      ))}
    </BaseRadioGroup>
  );
}
