import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { CheckboxGroup as BaseCheckboxGroup } from '@base-ui/react/checkbox-group';
import { Field } from '@base-ui/react/field';
import type { ComponentPropsWithoutRef, FocusEvent, ReactElement } from 'react';
import { cn } from '../../lib/cn';
import { useGroupLabels } from './group-field';
import { OPTION_LIST, OptionItem, type OptionDef } from './option-item';

export interface CheckboxProps extends Omit<ComponentPropsWithoutRef<typeof BaseCheckbox.Root>, 'children' | 'className'> {
  /** Names the option. Omit inside a Setting Row (its title is the name) or a group (each option has one). */
  label?: string;
  description?: string;
  className?: string;
}

/*
 * Figma Checkbox: 16×16, radius xs, 1px `control/border` inside; checked / indeterminate = `control/on` fill, no
 * stroke, a 1.75px white mark. Hover darkens the border (fill when checked); disabled = `surface/disabled` +
 * `border/default` (unchecked) or `control/on-disabled` (checked).
 */
const BOX = [
  'fy:group/box fy:relative fy:inline-flex fy:size-4 fy:shrink-0 fy:items-center fy:justify-center fy:rounded-xs fy:border',
  'fy:border-control-border fy:bg-background-default fy:text-control-thumb fy:transition-colors fy:duration-100 fy:ease-out',
  'fy:hover:border-control-border-hover fy:group-hover/option:border-control-border-hover fy:group-data-[highlighted]/option:border-control-border-hover',
  'fy:data-checked:border-0 fy:data-checked:bg-control-on fy:data-checked:hover:bg-control-on-hover fy:data-checked:group-hover/option:bg-control-on-hover fy:data-checked:group-data-[highlighted]/option:bg-control-on-hover',
  'fy:data-indeterminate:border-0 fy:data-indeterminate:bg-control-on fy:data-indeterminate:hover:bg-control-on-hover fy:data-indeterminate:group-hover/option:bg-control-on-hover',
  'fy:data-disabled:cursor-not-allowed fy:data-disabled:border-border-default fy:data-disabled:bg-surface-disabled',
  'fy:data-disabled:hover:border-border-default fy:data-disabled:group-hover/option:border-border-default fy:data-disabled:group-data-[highlighted]/option:border-border-default',
  'fy:data-disabled:data-checked:border-0 fy:data-disabled:data-checked:bg-control-on-disabled fy:data-disabled:data-checked:hover:bg-control-on-disabled fy:data-disabled:data-checked:group-hover/option:bg-control-on-disabled fy:data-disabled:data-checked:group-data-[highlighted]/option:bg-control-on-disabled',
  'fy:data-disabled:data-indeterminate:border-0 fy:data-disabled:data-indeterminate:bg-control-on-disabled fy:data-disabled:data-indeterminate:hover:bg-control-on-disabled fy:data-disabled:data-indeterminate:group-hover/option:bg-control-on-disabled',
  'fy:focus-ring',
].join(' ');

const GLYPH = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {/* Figma: Check 7.5×5.25 at (4.25, 5.63), Dash 7 wide at (4.5, 8) inside the 16px box */}
    <path data-glyph="check" d="M4.25 8.375L6.75 10.875L11.75 5.625" className="fy:group-data-[indeterminate]/box:hidden" />
    <path data-glyph="dash" d="M4.5 8H11.5" className="fy:hidden fy:group-data-[indeterminate]/box:block" />
  </svg>
);

/** The bare 16px box. Inside a Setting Row / group the surrounding Field names it. */
function CheckboxBox({ className, ...props }: Omit<CheckboxProps, 'label' | 'description'>): ReactElement {
  return (
    <BaseCheckbox.Root {...props} data-slot="fy-checkbox" className={cn(BOX, className)}>
      <BaseCheckbox.Indicator className="fy:absolute fy:inset-0" data-slot="fy-checkbox-indicator">
        {GLYPH}
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}

/**
 * The same 16px box drawn as a picture, for a row that is itself the control (a listbox option in a Multi Select):
 * no input, no role — the option carries `aria-selected`. Hover and keyboard highlight come from the option
 * (`group/option`, `data-highlighted`).
 */
export function CheckboxMark({ checked, disabled }: { checked: boolean; disabled?: boolean }): ReactElement {
  return (
    <span
      aria-hidden="true"
      data-slot="fy-checkbox"
      data-checked={checked ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      className={cn(BOX, 'fy:pointer-events-none')}
    >
      {checked ? <span className="fy:absolute fy:inset-0">{GLYPH}</span> : null}
    </span>
  );
}

/**
 * Checkbox: any number of options, or agreeing to one statement. NOT an instant on/off setting — that is a Toggle.
 * `indeterminate` is a display state (a parent whose children are partly checked).
 */
export function Checkbox({ label, description, disabled, className, ...props }: CheckboxProps): ReactElement {
  if (!label) return <CheckboxBox {...props} disabled={disabled} className={className} />;

  return (
    <Field.Root disabled={disabled} name={props.name} className={className}>
      <OptionItem label={label} description={description} disabled={disabled} control={<CheckboxBox {...props} disabled={disabled} />} />
    </Field.Root>
  );
}

export interface CheckboxGroupProps {
  options: OptionDef[];
  /** Selected option values. */
  value: string[];
  onValueChange: (value: string[]) => void;
  /** Label of the "all" checkbox: checked when every enabled option is, Indeterminate when only some are. */
  parent?: string;
  disabled?: boolean;
  name?: string;
  className?: string;
  /** Focus left the group (bubbled `blur`; the caller decides whether it moved between options). */
  onBlur?: (event: FocusEvent<HTMLDivElement>) => void;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

/**
 * Checkbox group: must be inside a Field (Setting Row / GroupField), which names it. Options stack with 12px gaps; with `parent`, the options indent 24px toward the reading direction.
 * The value is reported in option order, so it is the same list the server stores.
 */
export function CheckboxGroup({ options, value, onValueChange, parent, disabled, name, className, ...aria }: CheckboxGroupProps): ReactElement {
  const labels = useGroupLabels();
  const enabled = options.filter((o) => !o.disabled).map((o) => o.value);

  return (
    <BaseCheckboxGroup
      {...labels}
      {...aria}
      value={value}
      allValues={parent ? enabled : undefined}
      disabled={disabled}
      data-slot="fy-checkbox-group"
      onValueChange={(next) => onValueChange(options.map((o) => o.value).filter((v) => next.includes(v)))}
      className={cn(OPTION_LIST, className)}
    >
      {parent ? <OptionItem label={parent} disabled={disabled} control={<CheckboxBox parent name={name} />} /> : null}
      <div className={cn(OPTION_LIST, parent && 'fy:ps-6')} data-slot="fy-checkbox-options">
        {options.map((option) => (
          <OptionItem
            key={option.value}
            label={option.label}
            description={option.description}
            disabled={disabled || option.disabled}
            control={<CheckboxBox value={option.value} name={name} disabled={disabled || option.disabled} />}
          />
        ))}
      </div>
    </BaseCheckboxGroup>
  );
}
