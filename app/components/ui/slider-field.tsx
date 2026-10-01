import { Field } from '@base-ui/react/field';
import type { ReactElement } from 'react';
import { cn } from '../../lib/cn';
import { FieldError } from './field-shell';
import { Slider, SliderValue, type SliderProps } from './slider';

export interface SliderFieldProps extends Omit<SliderProps, 'showValue' | 'aria-label' | 'aria-describedby' | 'className' | 'name'> {
  label: string;
  /** Figma "Show label" off: the label stays, for assistive technology only. */
  hideLabel?: boolean;
  /** Figma "Show value". On by default. */
  showValue?: boolean;
  /** Figma "Helper text" (replaced by `error` while the field is invalid). */
  description?: string;
  error?: string;
  name?: string;
  className?: string;
}

/** Figma "Slider": Header (Label, Value) → Control → Helper text (or error), 8px gaps. */
export function SliderField({ label, hideLabel, showValue = true, description, error, disabled, name, className, formatValue = String, ...slider }: SliderFieldProps): ReactElement {
  return (
    <Field.Root invalid={Boolean(error)} disabled={disabled} name={name} className={cn('fy:group/field fy:flex fy:w-full fy:flex-col fy:gap-2', className)} data-slot="fy-slider-field">
      <div className="fy:flex fy:items-center fy:gap-2">
        <Field.Label
          className={cn(
            'fy:min-w-0 fy:flex-1 fy:text-label-14-strong fy:text-text-primary fy:data-[disabled]:text-text-disabled',
            hideLabel && 'fy:sr-only',
          )}
        >
          {label}
        </Field.Label>
        {showValue ? <SliderValue>{formatValue(slider.value)}</SliderValue> : null}
      </div>
      <Slider {...slider} formatValue={formatValue} disabled={disabled} />
      {error ? (
        <FieldError>{error}</FieldError>
      ) : description ? (
        <Field.Description className="fy:text-copy-13 fy:text-text-secondary">{description}</Field.Description>
      ) : null}
    </Field.Root>
  );
}
