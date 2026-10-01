import { Radio as BaseRadio } from '@base-ui/react/radio';
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group';
import type { FocusEvent, ReactElement } from 'react';
import { cn } from '../../lib/cn';
import { useGroupLabels } from './group-field';

export interface SegmentOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/*
 * Figma Segment: 91×32 hug, padding 6/16, gap 6, `radius/md`, Label/14 `text/secondary`.
 * Hover = `surface/hover` + `text/primary`; Selected = `background/default` + Shadow/Small + Label/14 Strong;
 * Focus = the neutral ring (Figma draws a 2px `focus/ring-neutral` stroke); Disabled = `text/disabled`.
 */
const SEGMENT = [
  'fy:inline-flex fy:cursor-pointer fy:select-none fy:items-center fy:justify-center fy:gap-1.5 fy:rounded-md fy:px-4 fy:py-1.5',
  'fy:text-label-14 fy:text-text-secondary fy:transition-colors fy:duration-100 fy:ease-out',
  'fy:hover:bg-surface-hover fy:hover:text-text-primary',
  'fy:data-checked:bg-background-default fy:data-checked:text-label-14-strong fy:data-checked:text-text-primary fy:data-checked:shadow-small',
  'fy:data-checked:hover:bg-background-default',
  'fy:data-disabled:cursor-not-allowed fy:data-disabled:bg-transparent fy:data-disabled:text-text-disabled',
  'fy:data-disabled:hover:bg-transparent fy:data-disabled:hover:text-text-disabled',
  'fy:data-disabled:data-checked:bg-background-default fy:data-disabled:data-checked:text-text-disabled fy:data-disabled:data-checked:hover:bg-background-default',
  'fy:focus-ring',
].join(' ');

export interface SegmentedControlProps {
  /** 2–5 short options. Longer lists are a Select. */
  options: SegmentOption[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  name?: string;
  className?: string;
  /** Focus left the control (bubbled `blur`; the caller decides whether it moved between segments). */
  onBlur?: (event: FocusEvent<HTMLDivElement>) => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

/**
 * Segmented control: exactly one of a few mutually exclusive options, applied at once. A radio group underneath
 * (`role="radiogroup"`, roving focus, arrow keys: mirrored in RTL), drawn as a track of segments. The first option sits on the
 * start side: left in English, right in Persian.
 */
export function SegmentedControl({ options, value, onValueChange, disabled, name, className, ...aria }: SegmentedControlProps): ReactElement {
  const labels = useGroupLabels();
  return (
    <BaseRadioGroup
      {...labels}
      {...aria}
      value={value}
      name={name}
      disabled={disabled}
      data-slot="fy-segmented-control"
      onValueChange={(next) => onValueChange(String(next))}
      className={cn('fy:inline-flex fy:w-fit fy:max-w-full fy:items-center fy:gap-0.5 fy:rounded-lg fy:bg-surface-default fy:p-1', className)}
    >
      {options.map((option) => (
        <BaseRadio.Root key={option.value} value={option.value} disabled={disabled || option.disabled} data-slot="fy-segment" className={SEGMENT}>
          {option.label}
        </BaseRadio.Root>
      ))}
    </BaseRadioGroup>
  );
}
