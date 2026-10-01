import { Slider as BaseSlider } from '@base-ui/react/slider';
import type { FocusEvent, ReactElement } from 'react';
import { cn } from '../../lib/cn';

export type SliderSize = 'sm' | 'md';

/*
 * Figma Slider: Control = Track (`radius/full`, `surface/active`, 20 high Small / 24 Medium) + Range (`control/on`, 2px
 * padding) + Thumb (white pill, Shadow/Thumb; 24×16 Small / 28×20 Medium). The thumb sits inside the range with a 2px
 * rim, so Base UI's thumb is a transparent 4px-wider box (pill + rim) that travels edge to edge, and the range ends at
 * that box's far side. Hover = `control/on-hover`; Disabled = `control/off-disabled` track, `control/on-disabled` range,
 * a 1px `control/on-disabled` stroke on the thumb and no shadow.
 */
const TRACK: Record<SliderSize, string> = { sm: 'fy:h-5', md: 'fy:h-6' };
const THUMB_BOX: Record<SliderSize, string> = { sm: 'fy:h-5 fy:w-7', md: 'fy:h-6 fy:w-8' };
const THUMB_PILL: Record<SliderSize, string> = { sm: 'fy:h-4 fy:w-6', md: 'fy:h-5 fy:w-7' };
/** Width of the thumb box in px (pill + 2×2 rim): the range reaches its far side. */
const THUMB_BOX_PX: Record<SliderSize, number> = { sm: 28, md: 32 };

/** Largest "big" step (PageUp/PageDown, Shift+arrow): a tenth of the range, on the step grid. */
const largeStep = (min: number, max: number, step: number): number => Math.max(step, Math.round((max - min) / 10 / step) * step);

/** The header's Value: always LTR (a "%" or a minus sign must not jump sides), isolated from the label's direction. */
export function SliderValue({ children, className }: { children: string; className?: string }): ReactElement {
  return (
    <span
      dir="ltr"
      data-slot="fy-slider-value"
      className={cn('fy:shrink-0 fy:text-label-14 fy:text-text-secondary fy:[unicode-bidi:isolate] fy:group-data-[disabled]/field:text-text-disabled', className)}
    >
      {children}
    </span>
  );
}

export interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Figma `Size`: Small (dense forms) / Medium (standalone settings). */
  size?: SliderSize;
  disabled?: boolean;
  name?: string;
  className?: string;
  /** The text of a value ("75%", "۷۵٪"): shown in the header and announced as `aria-valuetext`. */
  formatValue?: (value: number) => string;
  /** Show the value above the control, at its end (a Setting Row names the slider but has no place for the value). */
  showValue?: boolean;
  /** The thumb lost focus (the caller validates). */
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  /** Only when nothing else names it: a Field label or Setting Row title normally does. */
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/**
 * Single-thumb slider over Base UI: drag or press the track; arrows move one step, Home/End jump to the ends,
 * PageUp/PageDown (and Shift+arrows) move by a tenth of the range. In RTL the whole control mirrors: the range fills
 * from the right and the thumb moves left as the value grows.
 */
export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  size = 'sm',
  disabled,
  name,
  className,
  formatValue = String,
  showValue,
  onBlur,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
}: SliderProps): ReactElement {
  const clamped = Math.min(max, Math.max(min, value));
  const ratio = (clamped - min) / (max - min);
  const box = THUMB_BOX_PX[size];

  return (
    <BaseSlider.Root
      value={clamped}
      min={min}
      max={max}
      step={step}
      largeStep={largeStep(min, max, step)}
      disabled={disabled}
      name={name}
      thumbAlignment="edge"
      onValueChange={(next) => onValueChange(next)}
      data-slot="fy-slider"
      data-size={size}
      className={cn('fy:group/slider fy:flex fy:w-full fy:flex-col fy:gap-2', className)}
    >
      {showValue ? (
        <div className="fy:flex fy:justify-end">
          <SliderValue>{formatValue(clamped)}</SliderValue>
        </div>
      ) : null}
      <BaseSlider.Control data-slot="fy-slider-control" className={cn('fy:relative fy:flex fy:w-full fy:items-center fy:data-disabled:cursor-not-allowed', TRACK[size])}>
        <BaseSlider.Track className="fy:flex fy:h-full fy:w-full fy:overflow-hidden fy:rounded-full fy:bg-surface-active fy:group-data-[disabled]/slider:bg-control-off-disabled">
          <div
            data-slot="fy-slider-range"
            className="fy:h-full fy:shrink-0 fy:rounded-full fy:bg-control-on fy:transition-colors fy:duration-100 fy:ease-out fy:group-hover/slider:bg-control-on-hover fy:group-data-[disabled]/slider:bg-control-on-disabled fy:group-data-[disabled]/slider:group-hover/slider:bg-control-on-disabled"
            style={{ width: `calc(${box}px + (100% - ${box}px) * ${ratio})` }}
          />
        </BaseSlider.Track>
        <BaseSlider.Thumb
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          getAriaValueText={(_formatted, current) => formatValue(current)}
          onBlur={onBlur}
          data-slot="fy-slider-thumb"
          className={cn('fy:flex fy:items-center fy:justify-center fy:rounded-full fy:focus-ring-within', THUMB_BOX[size])}
        >
          <span
            className={cn(
              'fy:box-border fy:block fy:rounded-full fy:bg-control-thumb fy:shadow-thumb',
              'fy:group-data-[disabled]/slider:border fy:group-data-[disabled]/slider:border-control-on-disabled fy:group-data-[disabled]/slider:shadow-none',
              THUMB_PILL[size],
            )}
          />
        </BaseSlider.Thumb>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}
