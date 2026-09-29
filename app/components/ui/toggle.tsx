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
  sm: 'fy:h-4 fy:w-7',
  md: 'fy:h-5 fy:w-9',
};

// Thumb travel = track − 2×2 padding − thumb: 28−4−12 = 12px (`translate-x-3`), 36−4−16 = 16px (`translate-x-4`).
const THUMB: Record<ToggleSize, string> = {
  sm: 'fy:size-3 fy:data-checked:translate-x-3 fy:rtl:data-checked:-translate-x-3',
  md: 'fy:size-4 fy:data-checked:translate-x-4 fy:rtl:data-checked:-translate-x-4',
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
        <Field.Description className="fy:text-copy-13 fy:text-text-secondary fy:ps-9 fy:group-data-[disabled]/field:text-text-disabled">
          {description}
        </Field.Description>
      ) : null}
    </Field.Root>
  );
}
