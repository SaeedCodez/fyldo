import type { ButtonSize } from './button';

export type ControlSize = ButtonSize;

/**
 * Shared look of every bordered field control (Input, Select trigger, Multi Select, Textarea). In Figma these
 * frames count the 1px stroke IN the layout (placeholder width 294 = 320 − 2×12 − 2×1), which is exactly CSS
 * `border-box` with a real border and 12px padding.
 *
 * States come from the surrounding `Field.Root` (`group/field`): invalid and disabled are data attributes on it, and
 * keyboard focus is the control's own `:focus-visible` (text inputs match it for pointer focus too).
 */
export const CONTROL_BASE = [
  'fy:flex fy:w-full fy:items-center fy:gap-2 fy:border fy:bg-background-default fy:text-text-primary',
  'fy:border-border-input fy:transition-colors fy:duration-100 fy:ease-out',
  'fy:hover:border-border-input-hover',
  // keyboard/pointer focus on the control inside: neutral border + Figma's soft halo
  'fy:has-[:focus-visible]:border-focus-border fy:has-[:focus-visible]:shadow-focus-input',
  // popup open (Select): same look as focus
  'fy:data-popup-open:border-focus-border fy:data-popup-open:shadow-focus-input',
  // error: red border + red halo, always on (wins over hover/focus)
  'fy:group-data-[invalid]/field:border-status-error-solid fy:group-data-[invalid]/field:shadow-focus-input-error',
  'fy:group-data-[invalid]/field:hover:border-status-error-solid fy:group-data-[invalid]/field:has-[:focus-visible]:border-status-error-solid',
  // disabled
  'fy:group-data-[disabled]/field:cursor-not-allowed fy:group-data-[disabled]/field:bg-surface-disabled fy:group-data-[disabled]/field:text-text-disabled',
  'fy:group-data-[disabled]/field:border-border-default fy:group-data-[disabled]/field:hover:border-border-default',
].join(' ');

export const CONTROL_SIZE: Record<ControlSize, string> = {
  sm: 'fy:h-8 fy:px-3 fy:rounded-sm fy:text-copy-14',
  md: 'fy:h-10 fy:px-3 fy:rounded-sm fy:text-copy-14',
  lg: 'fy:h-12 fy:px-3 fy:rounded-md fy:text-copy-16',
};
