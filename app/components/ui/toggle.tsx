import { Field } from '@base-ui/react/field';
import { Switch } from '@base-ui/react/switch';
import type { ComponentPropsWithoutRef, ReactElement } from 'react';
import { cn } from '../../lib/cn';

export type ToggleSize = 'sm' | 'md';

export interface ToggleProps extends Omit<ComponentPropsWithoutRef<typeof Switch.Root>, 'children' | 'className'> {
  /** Figma `Size`: Small 28×16 (dense lists), Medium 36×20 (standalone). */
  size?: ToggleSize;
  /** Label the FEATURE, not the state ("Enable caching"). Omit when a Setting Row supplies the name. */
  label?: string;
  description?: string;
  className?: string;
}

const TRACK: Record<ToggleSize, string> = {
  sm: 'fy:h-4.5 fy:w-8',
  md: 'fy:h-6 fy:w-11',
};

// Thumb travel = track − 2×2 padding − thumb: 32−4−14 = 14px (`translate-x-3.5`), 44−4−20 = 20px (`translate-x-5`).
const THUMB: Record<ToggleSize, string> = {
  sm: 'fy:size-3.5 fy:data-checked:translate-x-3.5 fy:rtl:data-checked:-translate-x-3.5',
  md: 'fy:size-5 fy:data-checked:translate-x-5 fy:rtl:data-checked:-translate-x-5',
};

/**
 * On/off switch. Bare (inside a Setting Row, which names it) or with its own label/description.
 * In RTL the whole control mirrors: "on" puts the thumb on the left.
 */
export function Toggle({ size = 'sm', label, description, className, ...props }: ToggleProps): ReactElement {
  const control = (
    <Switch.Root
      {...props}
      data-slot="fy-toggle"
      data-size={size}
      className={cn(
        'fy:inline-flex fy:shrink-0 fy:items-center fy:rounded-full fy:p-0.5 fy:transition-colors fy:duration-100 fy:ease-out',
        'fy:bg-control-off fy:hover:bg-control-off-hover fy:data-checked:bg-control-on fy:data-checked:hover:bg-control-on-hover',
        'fy:data-disabled:cursor-not-allowed fy:data-disabled:bg-control-off-disabled fy:data-disabled:hover:bg-control-off-disabled',
        'fy:data-disabled:data-checked:bg-control-on-disabled fy:data-disabled:data-checked:hover:bg-control-on-disabled',
        'fy:focus-ring',
        TRACK[size],
        !label && className,
      )}
    >
      <Switch.Thumb
        className={cn(
          'fy:block fy:rounded-full fy:bg-control-thumb fy:shadow-thumb fy:transition-transform fy:duration-100 fy:ease-out',
          'fy:data-disabled:shadow-none',
          THUMB[size],
        )}
      />
    </Switch.Root>
  );

  if (!label) return control;

  const labelStyle = size === 'sm' ? 'fy:text-label-13' : 'fy:text-label-14';

  return (
    <Field.Root disabled={props.disabled} className={cn('fy:group/field fy:flex fy:flex-col fy:gap-0.5', className)}>
      <Field.Label className={cn('fy:inline-flex fy:items-start fy:gap-2 fy:text-text-primary fy:data-[disabled]:text-text-disabled', size === 'md' && 'fy:gap-3')}>
        {control}
        <span className={cn(labelStyle, size === 'sm' && 'fy:pt-0', size === 'md' && 'fy:pt-0')}>{label}</span>
      </Field.Label>
      {description ? (
        <Field.Description className="fy:text-copy-13 fy:text-text-secondary fy:ps-9">
          {description}
        </Field.Description>
      ) : null}
    </Field.Root>
  );
}
